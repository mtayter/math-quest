# Math Quest 🧮

A gamified math-practice website for kids who find their grade-level math too easy.
No multiple choice — every answer is typed. Procedural problems, Socratic hints that
teach the *method* (never the answer), XP/levels/streaks/badges, adaptive difficulty,
and progress saved per Google account.

**Repo:** https://github.com/mtayter/math-quest

## How it works

- **Frontend:** plain HTML/CSS/JS, no build step (`static/`).
- **Backend:** Python 3, stdlib only — no pip dependencies (`server.py` + SQLite).
- **Auth:** Sign in with Google (Google Identity Services). The server verifies the
  ID token via Google's `tokeninfo` endpoint and keeps a 30-day session cookie.
  Sign-in is open to any signed-in Google account — there is no allow-list and
  no parent-email config.
- **Curriculum** (`static/curriculum.js`): 20 topics × 3 tiers, grades 4–12. Every problem is
  generated procedurally, with a hand-written Socratic hint ladder per problem type.
  Hints explain the method using a *parallel worked example* (different numbers)
  and ask guiding questions — they never compute the player's specific numbers.
- **Anti-guessing:** typed answers only; 3 attempts max per problem, then a fresh
  problem of the same type (the answer is never revealed, so guessing can't converge).
- **Adaptive difficulty:** rolling accuracy promotes/demotes tiers and scales
  number ranges (`heat`) per topic.
- **Hash routing:** the SPA routes on the URL hash — `#/` home, `#/play/<topic>`,
  `#/leaderboard`, `#/signin` (`#/family` still works as the old leaderboard name).
  Back/forward buttons work, refreshing restores the page you were on, and topic
  URLs are shareable deep links. After sign-in you land where the link pointed.
- **Section completion:** answering 8 problems correctly at the hardest tier
  (Tier 3) completes that section — the topic card shows a ✓ Completed badge and
  the completion is stored per player. On completion the app celebrates and
  auto-advances to the next uncompleted quest after 5 seconds (or back to the
  quest list once every quest is done). "Next quest" jumps immediately;
  "Keep practicing here" cancels the auto-advance. Navigating manually also
  cancels any pending auto-advance.
- **Difficulty chip:** every question's tier label carries a chip that reads by
  color *and* dots *and* word — ●○○ Easy (green), ●●○ Medium (amber),
  ●●● Difficult (red). The tier pills on the home-screen topic cards use the
  same colors, so the difficulty is visible at a glance.
- **Leaderboard:** every signed-in player can see everyone's XP, streaks, and
  per-topic accuracy (names + stats only — no emails).
- **Self-update:** the SPA polls `/api/version` (a hash of the static files) and
  shows a refresh banner when a deploy lands; on the home screen it reloads
  automatically after a 10-second countdown.
- **Privacy:** see [Privacy Policy](https://<your-hostname>/math/privacy.html)
  (served from your deployment once installed).

## Requirements

- Python 3 (stdlib only — no pip packages to install).
- Linux with systemd for the service (the app itself is just `python3 server.py`).
- A public hostname with HTTPS for Google sign-in (Google requires an
  `https://` JavaScript origin), plus a reverse proxy (Apache example below)
  if you want to serve it at `/math/`.

## Install

```bash
git clone https://github.com/mtayter/math-quest.git
cd math-quest
./install.sh
```

`install.sh` prompts for two values (see "Configuration" below), writes
`config.json` (mode `0600`, gitignored) and the systemd user unit
`~/.config/systemd/user/math-quest.service`, then reloads systemd, enables,
and restarts the service. It is idempotent — re-running it overwrites the same
config file and the same unit file, never creating duplicates; a saved value is
kept when you leave its prompt blank.

Non-interactive installs (CI, provisioning) read environment variables instead
of prompting — see `./install.sh --help`:

```bash
MATH_QUEST_GOOGLE_CLIENT_ID=<your-client-id> MATH_QUEST_PORT=18791 \
  ./install.sh --non-interactive
```

Manual install (no installer): copy `config.example.json` → `config.json`,
fill in `google_client_id` (and `port` if you want a different one), then run
`python3 server.py` (listens on 127.0.0.1:`port`, default 18791).

### Google OAuth client (2 minutes, one time)

1. Go to <https://console.cloud.google.com/apis/credentials> (create a project if needed).
2. *Create Credentials → OAuth client ID → Web application.*
3. Under **Authorized JavaScript origins**, add `https://<your-hostname>`.
   (No redirect URIs needed — the token comes back to the page directly.)
4. If prompted, configure the OAuth consent screen (External, app name "Math Quest").
   For a kid's supervised Google account, the parent must allow third-party sign-in
   in Family Link.
5. To open sign-in to anyone (not just test users), click **Publish app** on the
   OAuth consent screen. Use `https://<your-hostname>/math/privacy.html` as the
   privacy policy URL if asked.
6. Paste the client ID into the installer prompt (or `config.json` as
   `google_client_id`) and restart the service.

## Configuration

`config.json` (gitignored, `0600`) holds exactly two values — nothing else is
collected:

| Key | What it is |
|---|---|
| `google_client_id` | Google OAuth client ID (Web application) for Sign in with Google. |
| `port` | Local port the backend listens on (default `18791`). |

There is deliberately no parent-email / allow-list setting: the app is open to
anyone with a Google account. Player data (name, email, picture from Google;
attempts, XP, badges, progress) lives in the local SQLite database
`mathquest.db` (gitignored), never in the repo. `config.example.json` shows the
shape with a placeholder client ID.

## Deployment

`install.sh` handles the service. The remaining piece is a reverse proxy:
the frontend assumes it is served under the `/math/` mount point. Apache
example (install.sh prints the matching block for your chosen port):

```apache
<Location /math/>
    ProxyPass http://127.0.0.1:18791/
    ProxyPassReverse http://127.0.0.1:18791/
</Location>
```

```bash
# apache proxy (needs sudo):
sudo cp deploy/math-quest.conf /etc/apache2/conf-available/
sudo a2enconf math-quest && sudo systemctl reload apache2
```

Check the service with `systemctl --user status math-quest.service`.

### Home-WiFi note: split-horizon DNS

If your router lacks NAT loopback (hairpinning), devices on your home WiFi
cannot reach your server via its public hostname — the router returns the
public IP, which it then refuses to route back inside. The fix is
split-horizon DNS: run a DNS server (e.g. `dnsmasq`) on your home server,
bound to the server's LAN IP, with an override mapping
`<your-hostname>` → `<your-server-LAN-IP>`, and point your DHCP clients at
the server for DNS. External visitors keep resolving the public IP; home
devices resolve the LAN IP and connect directly.

Caveat: a secondary DNS server (e.g. a public resolver) is *not* strict
failover — a device may ask the secondary, get the public IP, and fail to
load the site that time. Retrying usually fixes it; if home devices report
intermittent failures, this is the first suspect. Do not work around it by
using the raw LAN IP in the browser — Google SSO requires the
`https://<your-hostname>` origin.

## Curriculum map

Grade levels are estimates for the typical US public-school curriculum
(Common Core era) — states and districts vary.

| Topic | Grades | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| 🍕 Fractions | 4–5 | Simplify & equivalent | Add/subtract, same denominator | Add/subtract, different denominators |
| 💵 Decimals | 5–6 | Place value, rounding, add | Multiply & convert | Divide |
| 🧮 Order of Operations | 5–6 | Two operations | Parentheses & mixed | Exponents & nested |
| 🌡️ Negative Numbers | 7–8 | Add/subtract (small) | Longer chains | Multiply & divide |
| ⚖️ Ratios & Proportions | 6–7 | Simplify, equivalent | Solve proportions | Unit rates & scaling |
| 📊 Percents | 6–7 | Basics (50/25/10%) | Percent of a number | Increase/decrease, find the whole |
| 🔍 Pre-Algebra | 7–8 | Evaluate, one-step eq. | Two-step equations | Parentheses, combining terms |
| 🔢 Factors & Exponents | 4–8 | Factors, remainders | GCF, LCM, factorization | Powers |
| 📈 Linear Equations | 8 | Slope & y-intercept | Write equations, both sides | Distributive, x-intercept |
| 🔀 Systems of Equations | 8 | Where do lines meet? | Solve a system | Elimination |
| 📐 Pythagorean Theorem | 8 | Find the hypotenuse | Find a missing leg | Word problems & distance |
| 🔬 Scientific Notation & Roots | 8 | Notation basics | Multiply & divide powers | Square & cube roots |
| 📉 Quadratics | 9–10 | Solve factored form | Factor & solve | Formula & vertex |
| 📏 Geometry | 9–10 | Angles | Triangles & transversals | Circles & coordinates |
| ⚡ Exponents & Logarithms | 10–11 | Exponent laws | Exponential equations & logs | Log properties |
| 🧩 Functions | 9–11 | Evaluate | Composition & inverse | Domain & transformations |
| 🌊 Trigonometry | 11–12 | Right-triangle trig | Unit circle | Equations & identities |
| 🔗 Sequences & Series | 11–12 | nth term | Series sums | Recursive & infinite |
| 🎲 Statistics & Probability | 10–11 | Mean, median, mode | Probability & counting | Conditional & expected value |
| ♾️ Calculus | 12 | Limits & rates | Derivatives | Integrals |

## Tuning content from results

Every attempt is logged in SQLite (`attempts` table: user, topic, tier, correct,
attempts_used, hints_used, xp, timestamp). Query per-topic accuracy to find weak
spots, then add/adjust generators in `static/curriculum.js` — each tier is one
`gen(rnd, heat)` function returning `{prompt, answer, hints}`.
