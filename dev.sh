#!/usr/bin/env bash
# Start Milo: API on :8000, web on :3000. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
(cd api && .venv/bin/uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 2) &
API=$!
trap 'kill $API 2>/dev/null' EXIT
cd web && npm run dev
