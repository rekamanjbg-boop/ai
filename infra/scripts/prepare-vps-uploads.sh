#!/usr/bin/env bash
set -euo pipefail

UPLOAD_DIR="${UPLOAD_DIR:-/home/ubuntu/ai-media-uploads}"

mkdir -p "${UPLOAD_DIR}"
chmod 755 "${UPLOAD_DIR}"

echo "Upload directory ready: ${UPLOAD_DIR}"
