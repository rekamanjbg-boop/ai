#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

services=(remotion-worker sync-worker comfyui-bridge ai-generation-worker ai-video-worker)

for service in "${services[@]}"; do
  if ! service_is_running "${service}"; then
    echo "${service}: not running" >&2
    exit 1
  fi

  if service_has_unhealthy_container "${service}"; then
    echo "${service}: unhealthy" >&2
    exit 1
  fi

  echo "${service}: running"
done
