# Deployment

## Docker Compose

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up --build -d
```

Production startup scripts live in `infra/scripts`.

```bash
chmod +x infra/scripts/*.sh
infra/scripts/start.sh
infra/scripts/healthcheck.sh
```

Individual checks:

```bash
infra/scripts/check-redis.sh
infra/scripts/check-storage.sh
infra/scripts/check-backend.sh
infra/scripts/check-hermes.sh
infra/scripts/check-workers.sh
```

Restart unhealthy services once:

```bash
infra/scripts/restart-unhealthy.sh
```

Run continuous worker monitoring:

```bash
MONITOR_INTERVAL_SECONDS=30 infra/scripts/monitor-workers.sh
```

Install the monitor as a systemd service:

```bash
sudo infra/scripts/install-systemd-monitor.sh
```

## Upload Local Files To VPS

Prepare the upload folder on the VPS:

```bash
ssh -i ~/aws.pem ubuntu@YOUR_VPS_IP 'bash -s' < infra/scripts/prepare-vps-uploads.sh
```

Upload from Linux/macOS/WSL:

```bash
VPS_HOST=YOUR_VPS_IP \
SSH_KEY=~/aws.pem \
LOCAL_PATH=./video.mp4 \
infra/scripts/upload-to-vps.sh
```

Upload from Windows PowerShell:

```powershell
.\infra\scripts\upload-to-vps.ps1 `
  -VpsHost YOUR_VPS_IP `
  -SshKey C:\path\aws.pem `
  -LocalPath C:\path\video.mp4
```

Default remote folder:

```text
/home/ubuntu/ai-media-uploads
```

Services in the production stack:

- `nginx`: public reverse proxy.
- `api`: private Node.js backend.
- `hermes`: private Python orchestration API.
- `storage`: private S3-compatible object storage.
- `storage-init`: one-shot bucket initialization job.
- `comfyui-bridge`: private ComfyUI bridge API only.
- `ai-generation-worker`: scalable AI image generation worker.
- `ai-video-worker`: scalable Replicate video generation worker.
- `redis`: private queue and memory store.
- `remotion-worker`: scalable render worker.
- `sync-worker`: scalable delivery/sync worker.

Container boundaries:

```text
orchestration      -> hermes
rendering          -> remotion-worker
storage            -> storage + storage-init
AI generation API  -> comfyui-bridge
AI generation jobs -> ai-generation-worker
AI video jobs      -> ai-video-worker
backend API        -> api
queue/cache        -> redis
reverse proxy      -> nginx
```

Scale worker pools independently:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --scale remotion-worker=3 --scale sync-worker=2
```

Scale AI generation separately:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --scale ai-generation-worker=3
```

Scale Replicate video generation separately:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --scale ai-video-worker=2
```

Public routes:

```text
GET /health               -> Node.js backend
WS  /v1/ws/progress       -> Node.js backend websocket
GET /hermes/health        -> Hermes orchestration service
GET /comfyui-bridge/health -> ComfyUI bridge service
```

## Nginx Reverse Proxy

The production proxy at `infra/nginx/default.conf` provides:

- Node backend routes under `/` and `/v1/`.
- Websocket upgrade support at `/v1/ws/progress`.
- Hermes routes under `/hermes/`.
- ComfyUI bridge routes under `/comfyui-bridge/`.
- `512m` global upload limit, with route-level limits for Hermes and ComfyUI bridge.
- gzip for JSON, JavaScript, CSS, SVG, XML, and text responses.
- Security headers including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.

## ComfyUI Bridge

Generate an image through an external ComfyUI API:

```bash
curl -X POST http://localhost/comfyui-bridge/v1/images \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","prompt":"cinematic product shot","width":1024,"height":1024}'
```

Submit a full ComfyUI workflow JSON:

```bash
curl -X POST http://localhost/comfyui-bridge/v1/workflows \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","workflow":{}}'
```

## Remotion Rendering

Queue render jobs through the Node backend:

```bash
curl -X POST http://localhost/v1/renders \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","compositionId":"Main","inputProps":{"title":"Launch","subtitle":"Rendered by Remotion"}}'
```

## Replicate AI Video Worker

The `ai-video-worker` consumes the `media.video_generation` BullMQ queue, submits async predictions to Replicate, polls status, uploads the resulting MP4 to S3-compatible storage, and reports progress through the existing websocket status channel.

```env
REPLICATE_API_TOKEN=...
REPLICATE_MODEL_OWNER=
REPLICATE_MODEL_NAME=
REPLICATE_MODEL_VERSION=
REPLICATE_DEPLOYMENT_OWNER=
REPLICATE_DEPLOYMENT_NAME=
REPLICATE_POLL_INTERVAL_MS=5000
REPLICATE_MAX_POLL_ATTEMPTS=240
REPLICATE_CANCEL_AFTER=30m
VIDEO_GENERATION_CONCURRENCY=1
```

Use either a model owner/name, a deployment owner/name, or a model version. Replicate file outputs are downloaded immediately and copied to S3 because Replicate API outputs are temporary.

Queue a video job:

```bash
curl -X POST http://localhost/v1/videos \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","orchestrationId":"orch_123","stage":"generate-video","prompt":"cinematic drone shot over a futuristic city","input":{"duration":5}}'
```

Follow progress:

```text
ws://YOUR_HOST/v1/ws/progress?jobId=JOB_ID
```

Follow progress over websocket:

```text
ws://YOUR_HOST/v1/ws/progress?jobId=JOB_ID
```

Use local artifact storage by default:

```env
STORAGE_DRIVER=local
LOCAL_STORAGE_ROOT=/data/media
```

Use S3-compatible artifact storage:

```env
STORAGE_DRIVER=s3
S3_REGION=us-east-1
S3_BUCKET=media-platform
S3_ENDPOINT=http://storage:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
S3_SIGNED_URL_TTL_SECONDS=3600
STORAGE_UPLOAD_RETRIES=3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

Cloudflare R2 example:

```env
STORAGE_DRIVER=s3
S3_REGION=auto
S3_BUCKET=your-r2-bucket
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```

## Nextcloud Sync

The `sync-worker` consumes the delivery queue and uploads render outputs to Nextcloud over WebDAV.

```env
NEXTCLOUD_WEBDAV_URL=https://cloud.example.com/remote.php/dav/files/USERNAME
NEXTCLOUD_USERNAME=USERNAME
NEXTCLOUD_PASSWORD=APP_PASSWORD
NEXTCLOUD_ROOT_FOLDER=/AI Media Platform
NEXTCLOUD_UPLOAD_RETRIES=3
SYNC_CONCURRENCY=2
```

Queue a sync job through the Node backend:

```bash
curl -X POST http://localhost/v1/sync \
  -H "content-type: application/json" \
  -d '{"projectId":"demo","source":{"storageKey":"renders/demo/JOB_ID.mp4"},"fileName":"final.mp4"}'
```

Supported sources:

```json
{"source":{"filePath":"/data/media/renders/demo/final.mp4"}}
{"source":{"storageKey":"renders/demo/final.mp4"}}
{"source":{"url":"https://signed-download-url.example/final.mp4"}}
```

Uploads are stored under:

```text
NEXTCLOUD_ROOT_FOLDER/projectId/version/fileName
```

If no `version` is supplied, the worker creates an ISO timestamp version folder.

## Hermes

Hermes is built from `infra/docker/Dockerfile.hermes` with its own Python virtualenv at `/opt/venv`.

```bash
curl http://localhost:8000/health
```

Hermes persistent memory stores Redis cache entries and durable SQLite records:

```env
HERMES_SQLITE_PATH=/data/hermes/hermes-memory.sqlite3
HERMES_MEMORY_TTL_SECONDS=0
```

The Docker stack mounts `hermes-data` at `/data/hermes`.

Memory endpoints:

```text
POST /hermes/v1/memory/task-history
GET  /hermes/v1/memory/task-history
PUT  /hermes/v1/memory/characters/{character_id}
PUT  /hermes/v1/memory/prompts/{prompt_id}
PUT  /hermes/v1/memory/workflows/{workflow_id}
```

## Codex Bridge

Hermes can invoke Codex CLI in isolated git workspaces when explicitly enabled:

```env
CODEX_BRIDGE_ENABLED=true
CODEX_WORKSPACE_ROOT=/data/codex-workspaces
CODEX_CLI_COMMAND=codex exec
CODEX_TIMEOUT_SECONDS=900
CODEX_MAX_PATCH_BYTES=2000000
```

The Docker stack mounts `codex-workspaces` at `/data/codex-workspaces`. The Hermes image includes `git`; install or mount the Codex CLI in the runtime image and set `CODEX_CLI_COMMAND` to the correct command.

Example:

```bash
curl -X POST http://localhost/hermes/v1/codex/runs \
  -H "content-type: application/json" \
  -d '{"project_id":"demo","task":"Review and create a focused patch","repo_url":"https://github.com/example/repo.git"}'
```

Each run logs a code review record to:

```text
/hermes/v1/memory/task-history
/hermes/v1/memory/code-review/{run_id}
```

## AWS VPS Checklist

- Security group allows `22`, `80`, and `443` only.
- Redis is not exposed publicly.
- App services are only reachable through Nginx.
- Docker service is enabled on boot.
- Backups cover object storage, database, and Redis if queue durability matters.
