#!/bin/sh
# Development with hot reload: start the database, wait until it is healthy, then run the server
# (http://localhost:3000, API and live stream) and the web app (http://localhost:5173, proxies /api
# to the server) in watch mode. Ctrl+C stops both; the database container keeps running.
set -eu
cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (local defaults)."
fi

echo "Starting the database..."
docker compose up -d --wait db

server_pid=""
web_pid=""
stop() {
  trap - INT TERM EXIT
  [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true
  [ -n "$web_pid" ] && kill "$web_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap stop EXIT
# Ctrl+C or a termination signal is a normal way to stop: shut down and report success.
trap 'exit 0' INT TERM

npm run dev -w @staffing/server &
server_pid=$!
npm run dev -w @staffing/web &
web_pid=$!

echo "Open http://localhost:5173 (manager) and http://localhost:5173/worker (worker)."

# If either process exits, stop the other one and report failure.
while kill -0 "$server_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done
echo "A dev process stopped; shutting down."
exit 1
