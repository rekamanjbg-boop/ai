#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  ./scripts/create-venv.sh
fi

. .venv/bin/activate
uvicorn hermes.main:app --host "${HERMES_HOST:-0.0.0.0}" --port "${HERMES_PORT:-8000}" --reload

