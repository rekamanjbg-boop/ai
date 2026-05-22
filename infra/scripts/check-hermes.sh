#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

if ! service_is_running hermes; then
  echo "Hermes container is not running" >&2
  exit 1
fi

wait_for_url "Hermes" "${DEFAULT_PUBLIC_URL}/hermes/health" 30 2
