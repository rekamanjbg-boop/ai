#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/infra/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
DEFAULT_PUBLIC_URL="${PUBLIC_URL:-http://127.0.0.1}"

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_runtime() {
  require_command docker
  require_command curl
}

require_env_file() {
  if [ ! -f "${ENV_FILE}" ]; then
    echo "Missing ${ENV_FILE}. Create it from .env.example before starting." >&2
    exit 1
  fi
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"
  local delay_seconds="${4:-2}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS --max-time 5 "${url}" >/dev/null; then
      echo "${name}: healthy"
      return 0
    fi

    sleep "${delay_seconds}"
  done

  echo "${name}: healthcheck timed out at ${url}" >&2
  return 1
}

service_container_ids() {
  local service="$1"
  compose ps -q "${service}" 2>/dev/null || true
}

service_is_running() {
  local service="$1"
  local ids
  ids="$(service_container_ids "${service}")"

  if [ -z "${ids}" ]; then
    return 1
  fi

  while IFS= read -r id; do
    [ -z "${id}" ] && continue
    local running
    running="$(docker inspect -f '{{.State.Running}}' "${id}" 2>/dev/null || echo false)"

    if [ "${running}" != "true" ]; then
      return 1
    fi
  done <<< "${ids}"

  return 0
}

service_has_unhealthy_container() {
  local service="$1"
  local ids
  ids="$(service_container_ids "${service}")"

  [ -z "${ids}" ] && return 1

  while IFS= read -r id; do
    [ -z "${id}" ] && continue
    local health
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${id}" 2>/dev/null || echo unknown)"

    if [ "${health}" = "unhealthy" ]; then
      return 0
    fi
  done <<< "${ids}"

  return 1
}

restart_service() {
  local service="$1"
  echo "Restarting ${service}..."
  compose up -d --no-deps --force-recreate "${service}"
}
