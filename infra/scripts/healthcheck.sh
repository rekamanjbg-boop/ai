#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/check-redis.sh"
bash "${SCRIPT_DIR}/check-storage.sh"
bash "${SCRIPT_DIR}/check-backend.sh"
bash "${SCRIPT_DIR}/check-hermes.sh"
bash "${SCRIPT_DIR}/check-workers.sh"

echo "All health checks passed."
