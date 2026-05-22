# AI Media Platform

Production-grade modular scaffold for a scalable AI media production system.

## Core Modules

- `apps/api`: Node.js backend API for jobs, projects, webhooks, and admin operations.
- `apps/hermes`: isolated Python orchestration service with Redis-backed memory and REST bridge.
- `apps/worker`: queue consumers for generation, rendering, post-processing, and delivery.
- `apps/remotion`: Remotion composition and rendering entrypoint.
- `packages/queue`: Redis/BullMQ queue definitions and job contracts.
- `packages/comfyui-bridge`: ComfyUI API client and workflow adapter layer.
- `packages/storage`: pluggable storage adapters for local, S3, and future providers.
- `packages/shared`: shared config, logger, types, and runtime helpers.
- `infra/docker`: production Dockerfiles and deployment helpers.

## Quick Start

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up --build
```

Scale production workers independently:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --scale remotion-worker=3 --scale sync-worker=2
docker compose -f infra/docker/docker-compose.yml up -d --scale ai-generation-worker=3
docker compose -f infra/docker/docker-compose.yml up -d --scale ai-video-worker=2
```

Production services are separated by responsibility:

```text
orchestration      -> hermes
rendering          -> remotion-worker
storage            -> storage
AI generation      -> comfyui-bridge + ai-generation-worker
AI video           -> ai-video-worker
backend API        -> api
queue/cache        -> redis
reverse proxy      -> nginx
```

Production startup and checks:

```bash
chmod +x infra/scripts/*.sh
infra/scripts/start.sh
infra/scripts/healthcheck.sh
infra/scripts/restart-unhealthy.sh
```

## API

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/v1/jobs \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","prompt":"cinematic product reel","format":"reel","assets":[]}'

curl http://localhost:3000/v1/renders/JOB_ID/status

curl -X POST http://localhost:3000/v1/renders \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","compositionId":"Main","inputProps":{"title":"Launch","subtitle":"Rendered by Remotion"}}'
```

Websocket progress stream:

```text
ws://localhost:3000/v1/ws/progress?jobId=JOB_ID
```

Hermes REST bridge:

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/v1/orchestrations \
  -H "content-type: application/json" \
  -d '{"project_id":"demo","prompt":"cinematic product reel","format":"reel","assets":[]}'

curl -X POST http://localhost:8000/v1/bridge/jobs \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","prompt":"cinematic product reel","format":"reel","assets":[]}'
```

ComfyUI bridge:

```bash
curl -X POST http://localhost/comfyui-bridge/v1/images \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","prompt":"cinematic product shot","width":1024,"height":1024}'
```

Nextcloud sync:

```bash
curl -X POST http://localhost/v1/sync \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","source":{"storageKey":"renders/demo/JOB_ID.mp4"},"fileName":"final.mp4"}'
```

Replicate AI video:

```bash
curl -X POST http://localhost/v1/videos \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","prompt":"cinematic drone shot over a futuristic city","input":{"duration":5}}'
```

Codex bridge:

```bash
curl -X POST http://localhost/hermes/v1/codex/runs \
  -H "content-type: application/json" \
  -d '{"project_id":"demo","task":"Review and create a focused patch","repo_url":"https://github.com/example/repo.git"}'
```

## Development Layout

```text
apps/
  api/
  hermes/
  worker/
  remotion/
packages/
  comfyui-bridge/
  queue/
  shared/
  storage/
infra/
  docker/
  nginx/
  redis/
```

## Production Notes

- Keep public traffic routed through Nginx.
- Keep Redis private to the Docker network or VPC.
- Run API, Hermes, and workers as separately scalable services.
- Store generated artifacts in object storage in production.
- Keep ComfyUI GPU nodes isolated behind an internal bridge URL.
