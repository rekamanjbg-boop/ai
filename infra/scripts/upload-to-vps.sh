#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Upload a local file or folder to an Ubuntu AWS VPS over SSH.

Usage:
  VPS_HOST=1.2.3.4 SSH_KEY=~/keys/aws.pem LOCAL_PATH=./file.mp4 ./infra/scripts/upload-to-vps.sh

Optional env:
  VPS_USER=ubuntu
  VPS_UPLOAD_DIR=/home/ubuntu/ai-media-uploads
  SSH_PORT=22
  USE_RSYNC=true

Examples:
  VPS_HOST=1.2.3.4 SSH_KEY=~/aws.pem LOCAL_PATH=./video.mp4 ./infra/scripts/upload-to-vps.sh
  VPS_HOST=1.2.3.4 SSH_KEY=~/aws.pem LOCAL_PATH=./assets USE_RSYNC=true ./infra/scripts/upload-to-vps.sh
EOF
}

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-}"
SSH_PORT="${SSH_PORT:-22}"
LOCAL_PATH="${LOCAL_PATH:-}"
VPS_UPLOAD_DIR="${VPS_UPLOAD_DIR:-/home/${VPS_USER}/ai-media-uploads}"
USE_RSYNC="${USE_RSYNC:-false}"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ -z "${VPS_HOST}" ] || [ -z "${SSH_KEY}" ] || [ -z "${LOCAL_PATH}" ]; then
  usage
  exit 1
fi

if [ ! -e "${LOCAL_PATH}" ]; then
  echo "LOCAL_PATH does not exist: ${LOCAL_PATH}" >&2
  exit 1
fi

if [ ! -f "${SSH_KEY}" ]; then
  echo "SSH_KEY does not exist: ${SSH_KEY}" >&2
  exit 1
fi

SSH_OPTS=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
)

echo "Preparing upload directory on VPS..."
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "mkdir -p '${VPS_UPLOAD_DIR}' && chmod 755 '${VPS_UPLOAD_DIR}'"

if [ "${USE_RSYNC}" = "true" ]; then
  if ! command -v rsync >/dev/null 2>&1; then
    echo "rsync is not installed locally. Install rsync or set USE_RSYNC=false." >&2
    exit 1
  fi

  echo "Uploading with rsync..."
  rsync -avz -e "ssh -i '${SSH_KEY}' -p '${SSH_PORT}' -o StrictHostKeyChecking=accept-new" \
    "${LOCAL_PATH}" \
    "${VPS_USER}@${VPS_HOST}:${VPS_UPLOAD_DIR}/"
else
  echo "Uploading with scp..."
  if [ -d "${LOCAL_PATH}" ]; then
    scp "${SSH_OPTS[@]}" -r "${LOCAL_PATH}" "${VPS_USER}@${VPS_HOST}:${VPS_UPLOAD_DIR}/"
  else
    scp "${SSH_OPTS[@]}" "${LOCAL_PATH}" "${VPS_USER}@${VPS_HOST}:${VPS_UPLOAD_DIR}/"
  fi
fi

echo "Upload complete."
echo "Remote path: ${VPS_USER}@${VPS_HOST}:${VPS_UPLOAD_DIR}/$(basename "${LOCAL_PATH}")"
