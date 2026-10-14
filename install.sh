#!/usr/bin/env bash
# Math Quest installer — self-contained, idempotent.
#
# What it does:
#   1. Collects config: Google OAuth client ID + port (prompts, or env vars).
#   2. Writes config.json next to this script (gitignored, mode 0600).
#   3. Writes the systemd user unit ~/.config/systemd/user/math-quest.service
#      (same path every run — re-running never creates duplicates).
#   4. Reloads systemd, enables, and restarts the service (unless --skip-service).
#
# Usage:
#   ./install.sh                        # interactive prompts
#   ./install.sh --non-interactive      # reads env vars, never prompts
#   ./install.sh --skip-service         # write config + unit only, don't touch systemd
#   ./install.sh --help                 # this help
#
# Environment variables (used as defaults interactively; required with
# --non-interactive unless a value already exists in config.json):
#   MATH_QUEST_GOOGLE_CLIENT_ID   Google OAuth client ID (Web application)
#   MATH_QUEST_PORT               Port to listen on (default 18791)
#
# The installer never prints the client ID back (not even as a "current
# value") — when re-installing, an existing client ID is kept if you
# leave the prompt blank.
#
# Config collected: google_client_id + port ONLY. No parent emails, no
# allow-list — sign-in is open to any signed-in Google account.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/config.json"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_PATH="$UNIT_DIR/math-quest.service"
UNIT_NAME="math-quest.service"
DEFAULT_PORT=18791

NON_INTERACTIVE=0
SKIP_SERVICE=0

usage() {
  sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    --skip-service) SKIP_SERVICE=1; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

# ---- read existing config (defaults on re-install) -----------------------
EXISTING_CLIENT_ID=""
EXISTING_PORT=""
if [ -f "$CONFIG_PATH" ]; then
  EXISTING_CLIENT_ID="$(python3 -c "import json;print(json.load(open('$CONFIG_PATH')).get('google_client_id',''))" 2>/dev/null || true)"
  EXISTING_PORT="$(python3 -c "import json;print(json.load(open('$CONFIG_PATH')).get('port',''))" 2>/dev/null || true)"
fi

# Precedence: env var > existing config.json > built-in default.
CLIENT_ID="${MATH_QUEST_GOOGLE_CLIENT_ID:-$EXISTING_CLIENT_ID}"
PORT="${MATH_QUEST_PORT:-${EXISTING_PORT:-$DEFAULT_PORT}}"

# ---- prompt (interactive only) -------------------------------------------
if [ "$NON_INTERACTIVE" -eq 0 ]; then
  cat <<'EOF'

Math Quest setup — two values needed:

  1) Google OAuth client ID. Create one (one time) at:
       https://console.cloud.google.com/apis/credentials
     Create Credentials → OAuth client ID → Web application.
     Under "Authorized JavaScript origins", add https://<your-hostname>
     (your public hostname — the one players will visit).
     No redirect URIs needed; the token comes back to the page directly.
     If prompted, configure the OAuth consent screen, then click
     "Publish app" to open sign-in to anyone (not just test users).
     Use https://<your-hostname>/math/privacy.html as the privacy
     policy URL if asked. For a kid's supervised Google account, the
     parent must allow third-party sign-in in Family Link.

  2) Port the backend listens on (localhost only; default 18791).
     The Apache / reverse-proxy config must forward to this port.

EOF
  if [ -n "$EXISTING_CLIENT_ID" ]; then
    echo "A client ID is already saved in config.json."
    echo "Press Enter to keep it, or paste a new one to replace it."
  fi
  printf "Google OAuth client ID: "
  read -r INPUT_CLIENT_ID || true
  if [ -n "${INPUT_CLIENT_ID:-}" ]; then
    CLIENT_ID="$INPUT_CLIENT_ID"
  fi
  printf "Port [%s]: " "$PORT"
  read -r INPUT_PORT || true
  if [ -n "${INPUT_PORT:-}" ]; then
    PORT="$INPUT_PORT"
  fi
fi

# ---- validate ---------------------------------------------------------------
if [ -z "$CLIENT_ID" ]; then
  echo "ERROR: no Google OAuth client ID. Set MATH_QUEST_GOOGLE_CLIENT_ID or run interactively." >&2
  exit 1
fi
case "$CLIENT_ID" in
  *.apps.googleusercontent.com) ;;
  *) echo "WARNING: client ID does not end in .apps.googleusercontent.com — continuing anyway (check for a copy/paste error)." >&2 ;;
esac
case "$PORT" in
  ''|*[!0-9]*)
    echo "ERROR: port must be a number, got: $PORT" >&2; exit 1 ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "ERROR: port out of range (1-65535): $PORT" >&2; exit 1
fi

# ---- write config.json (0600) ------------------------------------------------
python3 - "$CONFIG_PATH" "$CLIENT_ID" "$PORT" <<'PYEOF'
import json, os, sys
path, client_id, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
with open(path, "w") as f:
    json.dump({"google_client_id": client_id, "port": port}, f, indent=2)
    f.write("\n")
os.chmod(path, 0o600)
PYEOF
echo "Wrote $CONFIG_PATH (mode 0600)."

# Keep the secret out of git even if .gitignore was edited: re-add if missing.
GITIGNORE="$SCRIPT_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  grep -qx "config.json" "$GITIGNORE" || { echo "config.json" >> "$GITIGNORE"; echo "Added config.json to .gitignore."; }
else
  printf 'config.json\n' > "$GITIGNORE"
  echo "Created .gitignore with config.json."
fi

# ---- write systemd user unit (same path every run = no duplicates) ------------
mkdir -p "$UNIT_DIR"
PYTHON_BIN="$(command -v python3)"
cat > "$UNIT_PATH" <<EOF
[Unit]
Description=Math Quest - gamified math practice for kids
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$PYTHON_BIN $SCRIPT_DIR/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
echo "Wrote $UNIT_PATH."

# ---- systemd: reload + enable + restart --------------------------------------
if [ "$SKIP_SERVICE" -eq 1 ]; then
  echo "Skipped service steps (--skip-service). To start manually:"
  echo "  systemctl --user daemon-reload"
  echo "  systemctl --user enable --now $UNIT_NAME"
else
  if systemctl --user daemon-reload 2>/dev/null; then
    systemctl --user enable "$UNIT_NAME" 2>/dev/null || true
    if systemctl --user restart "$UNIT_NAME" 2>/dev/null; then
      echo "Service $UNIT_NAME enabled and restarted."
    else
      echo "NOTE: could not restart $UNIT_NAME (it may not be running yet). Start it with:"
      echo "  systemctl --user start $UNIT_NAME"
    fi
  else
    echo "NOTE: no systemd user instance available (daemon-reload failed)."
    echo "Config + unit are written; enable/start them where systemd runs:"
    echo "  systemctl --user daemon-reload"
    echo "  systemctl --user enable --now $UNIT_NAME"
  fi
fi

# ---- reverse-proxy next step ---------------------------------------------------
cat <<EOF

Next: expose the app behind a reverse proxy at /math/ (the frontend
assumes the /math/ mount point). Apache example — install as
/etc/apache2/conf-available/math-quest.conf, then
"a2enconf math-quest && systemctl reload apache2":

    <Location /math/>
        ProxyPass http://127.0.0.1:$PORT/
        ProxyPassReverse http://127.0.0.1:$PORT/
    </Location>

Add https://<your-hostname> under Authorized JavaScript origins for
your OAuth client (see the setup notes above), then visit
https://<your-hostname>/math/ and sign in with Google.
EOF
