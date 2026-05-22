#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime

interval_seconds="${MONITOR_INTERVAL_SECONDS:-30}"
services=(remotion-worker sync-worker comfyui-bridge ai-generation-worker ai-video-worker)

echo "Monitoring workers every ${interval_seconds}s. Press Ctrl+C to stop."

while true; do
  for service in "${services[@]}"; do
    if ! service_is_running "${service}"; then
      echo "$(date -Is) ${service}: not running"
      restart_service "${service}"
      continue
    fi

    if service_has_unhealthy_container "${service}"; then
      echo "$(date -Is) ${service}: unhealthy"
      restart_service "${service}"
      continue
    fi

    echo "$(date -Is) ${service}: ok"
  done

  sleep "${interval_seconds}"
done
