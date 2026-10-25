#!/usr/bin/env bash
# Starts Vajra Cloud inside a GitHub Codespace and makes it public.
# Runs automatically on Codespace start; safe to re-run by hand:
#   bash scripts/codespace-start.sh
set -e
cd "$(dirname "$0")/.."

# Lifecycle hooks don't always inherit the Codespace variables
# (CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) — load them
if [ -f /workspaces/.codespaces/shared/.env ]; then
  set -a; . /workspaces/.codespaces/shared/.env; set +a
fi

[ -d node_modules ] || npm run install:all
[ -d frontend/dist ] || npm --prefix frontend run build
[ -f backend/.env ] || cp backend/.env.example backend/.env

# Restart cleanly if it is already running
pkill -f "node backend/src/server.js" 2>/dev/null || true
sleep 1

# setsid + nohup keep the server alive after this script exits
PORT=4000 AUTO_ENABLE_SCALING=true setsid nohup node backend/src/server.js > /tmp/vajra.log 2>&1 < /dev/null &

echo "Waiting for Vajra Cloud to start..."
for i in $(seq 1 30); do
  curl -sf http://localhost:4000/api/health > /dev/null && break
  sleep 1
done

if [ -n "$CODESPACE_NAME" ]; then
  # The port has to be forwarded before it can be made public — retry briefly
  for i in $(seq 1 10); do
    gh codespace ports visibility 4000:public -c "$CODESPACE_NAME" > /dev/null 2>&1 && break
    sleep 2
  done
  echo ""
  echo "  Vajra Cloud is live:"
  echo "  https://${CODESPACE_NAME}-4000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  echo ""
  echo "  If the link asks you to sign in, open the PORTS tab,"
  echo "  right-click port 4000 → Port Visibility → Public."
else
  echo "Vajra Cloud running at http://localhost:4000"
fi
echo "Logs: tail -f /tmp/vajra.log"
