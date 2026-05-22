#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

if ! service_is_running redis; then
  echo "Redis container is not running" >&2
  exit 1
fi

if [ "$(compose exec -T redis redis-cli ping)" != "PONG" ]; then
  echo "Redis ping failed" >&2
  exit 1
fi

echo "Redis: healthy"
