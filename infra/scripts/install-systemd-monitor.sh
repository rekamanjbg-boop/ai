#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVICE_FILE="/etc/systemd/system/ai-media-platform-monitor.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=AI Media Platform worker monitor
Requires=docker.service
After=docker.service

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
Environment=MONITOR_INTERVAL_SECONDS=30
ExecStart=/usr/bin/env bash ${PROJECT_ROOT}/infra/scripts/monitor-workers.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ai-media-platform-monitor.service
systemctl status ai-media-platform-monitor.service --no-pager
