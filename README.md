# Math Quest 🧮

A gamified math-practice website for kids who find their grade-level math too easy.
No multiple choice — every answer is typed. Procedural problems, Socratic hints that
teach the *method* (never the answer), XP/levels/streaks/badges, adaptive difficulty,
and progress saved per Google account.

**Live:** https://mtayter.noip.me/math/ · **Repo:** https://github.com/mtayter/math-quest

## How it works

- **Frontend:** plain HTML/CSS/JS, no build step (`static/`).
- **Backend:** Python 3, stdlib only — no pip dependencies (`server.py` + SQLite).
- **Auth:** Sign in with Google (Google Identity Services). The server verifies the
  ID token via Google's `tokeninfo` endpoint and keeps a 30-day session cookie.
- **Curriculum** (`static/curriculum.js`): 8 topics × 3 tiers. Every problem is
  generated procedurally, with a hand-written Socratic hint ladder per problem type.
  Hints explain the method using a *parallel worked example* (different numbers)
  and ask guiding questions — they never compute the player's specific numbers.
- **Anti-guessing:** typed answers only; 3 attempts max per problem, then a fresh
  problem of the same type (the answer is never revealed, so guessing can't converge).
- **Adaptive difficulty:** rolling accuracy promotes/demotes tiers and scales
  number ranges (`heat`) per topic.
- **Parents:** put your email in `parent_emails` in `config.json` to unlock the
  Family stats view (per-topic accuracy per player — use it to tune the curriculum).

## Setup

1. Copy `config.example.json` → `config.json` and fill in:
   - `google_client_id` — see "Google OAuth client" below.
   - `parent_emails` — emails that can see the Family stats view.
2. Run: `python3 server.py` (listens on 127.0.0.1:18791 by default).

### Google OAuth client (2 minutes, one time)

1. Go to <https://console.cloud.google.com/apis/credentials> (create a project if needed).
2. *Create Credentials → OAuth client ID → Web application.*
3. Under **Authorized JavaScript origins**, add `https://mtayter.noip.me`.
   (No redirect URIs needed — the token comes back to the page directly.)
4. If prompted, configure the OAuth consent screen (External, app name "Math Quest").
   For a kid's supervised Google account, the parent must allow third-party sign-in
   in Family Link.
5. Paste the client ID into `config.json` as `google_client_id` and restart.

## Deployment (home server)

```bash
# on the server, as slick:
git clone https://github.com/mtayter/math-quest.git ~/math-quest
cp config.example.json config.json   # then edit in the client ID
mkdir -p ~/.config/systemd/user
cp deploy/math-quest.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now math-quest.service

# apache proxy (needs sudo):
sudo cp deploy/math-quest.conf /etc/apache2/conf-available/
sudo a2enconf math-quest && sudo systemctl reload apache2
```

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

## Tuning content from results

Every attempt is logged in SQLite (`attempts` table: user, topic, tier, correct,
attempts_used, hints_used, xp, timestamp). Query per-topic accuracy to find weak
spots, then add/adjust generators in `static/curriculum.js` — each tier is one
`gen(rnd, heat)` function returning `{prompt, answer, hints}`.
