#!/usr/bin/env python3
"""Math Quest backend: stdlib-only HTTP + SQLite + Google SSO.

Routes (an optional /math prefix is stripped, so it works behind the Apache
/math/ proxy as well as directly):
  GET  /                      -> index.html
  GET  /static/<path>         -> static files
  GET  /api/config            -> {google_client_id}
  POST /api/auth              {id_token} -> verifies via Google, sets session cookie
  GET  /api/me                -> user + stats (auth required)
  POST /api/attempt           {topic,tier,correct,attempts_used,hints_used} (auth)
  GET  /api/family            -> per-user stats (parent emails only)
  POST /api/logout
"""
import hashlib
import json
import math
import os
import secrets
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
DB_PATH = os.path.join(HERE, "mathquest.db")
CONFIG_PATH = os.path.join(HERE, "config.json")

config = {"google_client_id": "", "parent_emails": [], "port": 18791}
if os.path.exists(CONFIG_PATH):
    with open(CONFIG_PATH) as f:
        config.update(json.load(f))

db_lock = threading.Lock()
db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.row_factory = sqlite3.Row

with db_lock:
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY, sub TEXT UNIQUE, email TEXT, name TEXT,
      picture TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT, expires_at TEXT);
    CREATE TABLE IF NOT EXISTS attempts(
      id INTEGER PRIMARY KEY, user_id INTEGER, topic TEXT, tier INTEGER,
      correct INTEGER, attempts_used INTEGER, hints_used INTEGER, xp INTEGER,
      created_at TEXT);
    CREATE TABLE IF NOT EXISTS profile(
      user_id INTEGER PRIMARY KEY, xp INTEGER DEFAULT 0, day_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0, cur_streak INTEGER DEFAULT 0, last_day TEXT,
      correct_today INTEGER DEFAULT 0, total_correct INTEGER DEFAULT 0,
      total_attempted INTEGER DEFAULT 0, hints_used INTEGER DEFAULT 0,
      badges TEXT DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS user_topics(
      user_id INTEGER, topic TEXT, tier INTEGER DEFAULT 0, heat REAL DEFAULT 0.4,
      PRIMARY KEY(user_id, topic));
    """)
    db.commit()

TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"


def verify_google_token(id_token):
    """Verify an ID token via Google's tokeninfo endpoint (stdlib HTTPS)."""
    if not config.get("google_client_id"):
        return None, "server not configured"
    url = TOKENINFO + "?" + urllib.parse.urlencode({"id_token": id_token})
    req = urllib.request.Request(url, headers={"User-Agent": "math-quest"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            info = json.loads(r.read().decode())
    except Exception:
        return None, "token rejected"
    if info.get("aud") != config["google_client_id"]:
        return None, "audience mismatch"
    if int(info.get("exp", 0)) < time.time():
        return None, "token expired"
    return info, None


def get_user(uid):
    with db_lock:
        return db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()


def get_or_create_user(info):
    with db_lock:
        row = db.execute("SELECT * FROM users WHERE sub=?", (info["sub"],)).fetchone()
        if row:
            db.execute("UPDATE users SET name=?, picture=?, email=? WHERE id=?",
                       (info.get("name"), info.get("picture"), info.get("email"), row["id"]))
            db.commit()
            return row["id"]
        cur = db.execute(
            "INSERT INTO users(sub,email,name,picture,created_at) VALUES(?,?,?,?,?)",
            (info["sub"], info.get("email"), info.get("name"), info.get("picture"),
             datetime.utcnow().isoformat()))
        db.execute("INSERT INTO profile(user_id) VALUES(?)", (cur.lastrowid,))
        db.commit()
        return cur.lastrowid


def level_for_xp(xp):
    return int((1 + math.sqrt(1 + xp / 12.5)) / 2)


def topic_stats(uid):
    """Rolling stats per topic: mastery, heat, tier, counts."""
    out = {}
    with db_lock:
        rows = db.execute(
            "SELECT topic, tier, heat FROM user_topics WHERE user_id=?", (uid,)).fetchall()
        tiers = {r["topic"]: r["tier"] for r in rows}
        heats = {r["topic"]: r["heat"] for r in rows}
        for (topic,) in db.execute("SELECT DISTINCT topic FROM attempts WHERE user_id=?", (uid,)):
            last = db.execute(
                "SELECT correct FROM attempts WHERE user_id=? AND topic=? ORDER BY id DESC LIMIT 20",
                (uid, topic)).fetchall()
            acc = sum(r["correct"] for r in last) / len(last)
            last8 = db.execute(
                "SELECT correct FROM attempts WHERE user_id=? AND topic=? ORDER BY id DESC LIMIT 8",
                (uid, topic)).fetchall()
            acc8 = sum(r["correct"] for r in last8) / len(last8)
            out[topic] = {"mastery": round(acc * 100, 1), "accuracy8": round(acc8, 3),
                          "tier": tiers.get(topic, 0), "heat": heats.get(topic, 0.4),
                          "attempted": len(last)}
    return out


def full_stats(uid):
    with db_lock:
        p = db.execute("SELECT * FROM profile WHERE user_id=?", (uid,)).fetchone()
    if not p:
        return None
    xp = p["xp"]
    return {
        "xp": xp, "level": level_for_xp(xp),
        "day_streak": p["day_streak"], "best_streak": p["best_streak"],
        "correct_today": p["correct_today"], "total_correct": p["total_correct"],
        "total_attempted": p["total_attempted"],
        "badges": json.loads(p["badges"] or "[]"),
        "topics": topic_stats(uid),
    }


BADGE_RULES = [
    ("first_steps", lambda p, ts: p["total_correct"] >= 1),
    ("streak_5", lambda p, ts: p["cur_streak"] >= 5),
    ("streak_10", lambda p, ts: p["cur_streak"] >= 10),
    ("level_3", lambda p, ts: level_for_xp(p["xp"]) >= 3),
    ("level_5", lambda p, ts: level_for_xp(p["xp"]) >= 5),
    ("topic_master", lambda p, ts: any(t["mastery"] >= 90 and t["attempted"] >= 10 for t in ts.values())),
    ("tier3_hero", lambda p, ts: any(t["tier"] == 2 and t["attempted"] >= 8 and t["accuracy8"] >= 0.75 for t in ts.values())),
    ("hundred", lambda p, ts: p["total_correct"] >= 100),
    ("helper", lambda p, ts: p["hints_used"] >= 10),
    ("persistent", lambda p, ts: p["day_streak"] >= 7),
]


def record_attempt(uid, topic, tier, correct, attempts_used, hints_used):
    today = datetime.now().date().isoformat()
    new_badges = []
    with db_lock:
        p = db.execute("SELECT * FROM profile WHERE user_id=?", (uid,)).fetchone()
        old_level = level_for_xp(p["xp"])
        xp_earned = 0
        if correct:
            mult = 2.0 if attempts_used <= 1 else 1.5 if attempts_used == 2 else 1.0
            cur = p["cur_streak"] + 1
            xp_earned = round(10 * (tier + 1) * mult) + min(cur, 10) * 2
        else:
            cur = 0
        # daily streak bookkeeping
        last_day = p["last_day"]
        if last_day == today:
            day_streak, correct_today = p["day_streak"], p["correct_today"] + (1 if correct else 0)
        elif last_day == (datetime.now().date() - timedelta(days=1)).isoformat():
            day_streak, correct_today = p["day_streak"] + 1, (1 if correct else 0)
        else:
            day_streak, correct_today = 1, (1 if correct else 0)
        db.execute("""UPDATE profile SET xp=xp+?, cur_streak=?, best_streak=max(best_streak,?),
                      day_streak=?, last_day=?, correct_today=?,
                      total_correct=total_correct+?, total_attempted=total_attempted+1,
                      hints_used=hints_used+? WHERE user_id=?""",
                   (xp_earned, cur, cur, day_streak, today, correct_today,
                    1 if correct else 0, hints_used or 0, uid))
        db.execute("""INSERT INTO attempts(user_id,topic,tier,correct,attempts_used,
                      hints_used,xp,created_at) VALUES(?,?,?,?,?,?,?,?)""",
                   (uid, topic, tier, 1 if correct else 0, attempts_used, hints_used or 0,
                    xp_earned, datetime.utcnow().isoformat()))
        db.execute("INSERT OR IGNORE INTO user_topics(user_id,topic) VALUES(?,?)", (uid, topic))
        # adaptive heat: rolling accuracy over last 10
        last10 = db.execute(
            "SELECT correct FROM attempts WHERE user_id=? AND topic=? ORDER BY id DESC LIMIT 10",
            (uid, topic)).fetchall()
        acc10 = sum(r["correct"] for r in last10) / len(last10)
        heat = max(0.05, min(1.0, acc10))
        # adaptive tier suggestion
        last8 = db.execute(
            "SELECT correct FROM attempts WHERE user_id=? AND topic=? AND tier=? ORDER BY id DESC LIMIT 8",
            (uid, topic, tier)).fetchall()
        cur_tier_row = db.execute("SELECT tier FROM user_topics WHERE user_id=? AND topic=?",
                                  (uid, topic)).fetchone()
        cur_tier = cur_tier_row["tier"]
        suggest_tier = cur_tier
        if len(last8) >= 5:
            acc8 = sum(r["correct"] for r in last8) / len(last8)
            if acc8 >= 0.8 and cur_tier < 2:
                suggest_tier = cur_tier + 1
            elif acc8 <= 0.35 and cur_tier > 0:
                suggest_tier = cur_tier - 1
        db.execute("UPDATE user_topics SET tier=?, heat=? WHERE user_id=? AND topic=?",
                   (suggest_tier, heat, uid, topic))
        # badges
        p2 = db.execute("SELECT * FROM profile WHERE user_id=?", (uid,)).fetchone()
        pd = dict(p2)
        earned = set(json.loads(pd["badges"] or "[]"))
        ts = {}  # light topic stats for badge rules
        for (t,) in db.execute("SELECT DISTINCT topic FROM attempts WHERE user_id=?", (uid,)):
            lr = db.execute("SELECT correct FROM attempts WHERE user_id=? AND topic=? ORDER BY id DESC LIMIT 20",
                            (uid, t)).fetchall()
            tr = db.execute("SELECT tier FROM user_topics WHERE user_id=? AND topic=?", (uid, t)).fetchone()
            l8 = db.execute("SELECT correct FROM attempts WHERE user_id=? AND topic=? ORDER BY id DESC LIMIT 8",
                            (uid, t)).fetchall()
            ts[t] = {"mastery": sum(r["correct"] for r in lr) / len(lr) * 100,
                     "attempted": len(lr), "tier": tr["tier"] if tr else 0,
                     "accuracy8": sum(r["correct"] for r in l8) / len(l8)}
        for bid, rule in BADGE_RULES:
            if bid not in earned and rule(pd, ts):
                earned.add(bid)
                new_badges.append(bid)
        db.execute("UPDATE profile SET badges=? WHERE user_id=?", (json.dumps(sorted(earned)), uid))
        db.commit()
    stats = full_stats(uid)
    return {"xp_earned": xp_earned, "leveled_up": stats["level"] > old_level,
            "new_badges": new_badges, "suggest": {"tier": suggest_tier, "heat": heat},
            "stats": stats}


MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8", ".json": "application/json",
        ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"}


class Handler(BaseHTTPRequestHandler):
    server_version = "MathQuest/1.0"

    def log_message(self, *a):
        pass  # quiet; see error log via systemd journal

    # ---- helpers ----
    def _strip_prefix(self, path):
        if path == "/math" or path.startswith("/math/"):
            path = path[5:] or "/"
        return path

    def _send(self, code, body, ctype="application/json", cookies=None):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        for c in cookies or []:
            self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, obj, cookies=None):
        self._send(code, json.dumps(obj), cookies=cookies)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        return self.rfile.read(n) if n else b""

    def _session_user(self):
        cookie = self.headers.get("Cookie", "")
        m = None
        for part in cookie.split(";"):
            part = part.strip()
            if part.startswith("mq_session="):
                m = part[len("mq_session="):]
        if not m:
            return None
        th = hashlib.sha256(m.encode()).hexdigest()
        with db_lock:
            row = db.execute("SELECT user_id, expires_at FROM sessions WHERE token_hash=?",
                             (th,)).fetchone()
        if not row or row["expires_at"] < datetime.utcnow().isoformat():
            return None
        return row["user_id"]

    # ---- routing ----
    def do_GET(self):
        path = self._strip_prefix(urllib.parse.urlparse(self.path).path)
        if path in ("/", ""):
            return self._serve_file("index.html")
        if path.startswith("/static/"):
            return self._serve_file(path[len("/static/"):])
        if path == "/api/config":
            return self._json(200, {"google_client_id": config.get("google_client_id", "")})
        if path == "/api/me":
            uid = self._session_user()
            if not uid:
                # 200 (not 401): "are you signed in?" is a status probe, and a
                # 200 keeps the browser console clean for signed-out visitors.
                return self._json(200, {"ok": False, "signed_in": False})
            u = get_user(uid)
            return self._json(200, {"ok": True,
                                    "user": {"name": u["name"], "email": u["email"], "picture": u["picture"]},
                                    "stats": full_stats(uid),
                                    "is_parent": (u["email"] or "").lower() in
                                    [e.lower() for e in config.get("parent_emails", [])]})
        if path == "/api/family":
            uid = self._session_user()
            if not uid:
                return self._json(401, {"ok": False})
            u = get_user(uid)
            if (u["email"] or "").lower() not in [e.lower() for e in config.get("parent_emails", [])]:
                return self._json(403, {"ok": False})
            users = []
            with db_lock:
                rows = db.execute("SELECT * FROM users ORDER BY created_at").fetchall()
            for r in rows:
                st = full_stats(r["id"])
                topics = {}
                for tid, t in st["topics"].items():
                    with db_lock:
                        rr = db.execute(
                            "SELECT COUNT(*) c, SUM(correct) s FROM attempts WHERE user_id=? AND topic=?",
                            (r["id"], tid)).fetchone()
                    topics[tid] = {"correct": rr["s"] or 0, "attempted": rr["c"],
                                   "accuracy": (rr["s"] or 0) / rr["c"] if rr["c"] else 0,
                                   "tier": t["tier"]}
                users.append({"name": r["name"], "email": r["email"], "xp": st["xp"],
                              "level": st["level"], "day_streak": st["day_streak"],
                              "total_correct": st["total_correct"], "topics": topics})
            return self._json(200, {"ok": True, "users": users})
        return self._json(404, {"ok": False, "error": "not found"})

    def _serve_file(self, rel):
        # prevent path traversal
        safe = os.path.normpath(rel).lstrip("/")
        full = os.path.join(STATIC, safe)
        if not full.startswith(STATIC) or not os.path.isfile(full):
            return self._json(404, {"ok": False})
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=300")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        path = self._strip_prefix(urllib.parse.urlparse(self.path).path)
        if path == "/api/auth":
            try:
                payload = json.loads(self._body() or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"ok": False})
            info, err = verify_google_token(payload.get("id_token", ""))
            if err:
                return self._json(401, {"ok": False, "error": err})
            uid = get_or_create_user(info)
            token = secrets.token_urlsafe(32)
            th = hashlib.sha256(token.encode()).hexdigest()
            exp = (datetime.utcnow() + timedelta(days=30)).isoformat()
            with db_lock:
                db.execute("INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)",
                           (th, uid, datetime.utcnow().isoformat(), exp))
                db.commit()
            u = get_user(uid)
            cookie = (f"mq_session={token}; Path=/; Max-Age=2592000; HttpOnly; "
                      f"SameSite=Lax; Secure")
            return self._json(200, {"ok": True,
                                    "user": {"name": u["name"], "email": u["email"], "picture": u["picture"]},
                                    "stats": full_stats(uid),
                                    "is_parent": (u["email"] or "").lower() in
                                    [e.lower() for e in config.get("parent_emails", [])]},
                              cookies=[cookie])
        if path == "/api/logout":
            uid = self._session_user()
            cookie_hdr = self.headers.get("Cookie", "")
            for part in cookie_hdr.split(";"):
                part = part.strip()
                if part.startswith("mq_session="):
                    th = hashlib.sha256(part[len("mq_session="):].encode()).hexdigest()
                    with db_lock:
                        db.execute("DELETE FROM sessions WHERE token_hash=?", (th,))
                        db.commit()
            return self._json(200, {"ok": True},
                              cookies=["mq_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure"])
        if path == "/api/attempt":
            uid = self._session_user()
            if not uid:
                return self._json(401, {"ok": False})
            try:
                p = json.loads(self._body() or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"ok": False})
            topic = str(p.get("topic", ""))[:40]
            try:
                tier = max(0, min(2, int(p.get("tier", 0))))
            except (TypeError, ValueError):
                tier = 0
            if not topic:
                return self._json(400, {"ok": False})
            r = record_attempt(uid, topic, tier, bool(p.get("correct")),
                               int(p.get("attempts_used") or 1), int(p.get("hints_used") or 0))
            r["ok"] = True
            return self._json(200, r)
        return self._json(404, {"ok": False})


def main():
    port = int(config.get("port", 18791))
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"math-quest listening on 127.0.0.1:{port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
