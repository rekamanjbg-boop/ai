#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

if ! service_is_running storage; then
  echo "Storage container is not running" >&2
  exit 1
fi

if service_has_unhealthy_container storage; then
  echo "Storage container is unhealthy" >&2
  exit 1
fi

echo "Storage: healthy"
