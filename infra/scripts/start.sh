#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "${SCRIPT_DIR}/common.sh"

require_runtime
require_env_file

echo "Starting AI media platform..."
compose pull --ignore-pull-failures
compose up --build -d

echo "Waiting for public health endpoints..."
bash "${SCRIPT_DIR}/healthcheck.sh"

echo "Startup complete."
compose ps
