#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

services=(redis storage hermes api comfyui-bridge ai-generation-worker ai-video-worker remotion-worker sync-worker nginx)
restarted=0

for service in "${services[@]}"; do
  if ! service_is_running "${service}"; then
    echo "${service}: not running"
    restart_service "${service}"
    restarted=1
    continue
  fi

  if service_has_unhealthy_container "${service}"; then
    echo "${service}: unhealthy"
    restart_service "${service}"
    restarted=1
    continue
  fi

  echo "${service}: ok"
done

if [ "${restarted}" -eq 1 ]; then
  echo "One or more services were restarted."
else
  echo "No restarts needed."
fi
