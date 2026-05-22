# Architecture

## Runtime Services

- API receives production requests and validates input.
- Hermes runs as an isolated Python service, persists orchestration memory in Redis, and converts production requests into workflow plans.
- Workers execute long-running queue tasks independently.
- Redis stores queue state, Hermes memory, orchestration plans, worker command streams, and job coordination.
- Remotion renders video compositions.
- ComfyUI bridge talks to isolated GPU image/video generation nodes.
- Storage adapters persist generated assets.
- Nginx terminates public HTTP traffic and proxies to the API.

## Scaling Model

- Scale `api` horizontally for request volume.
- Scale `hermes` for orchestration throughput.
- Scale `worker` by queue type and GPU or CPU profile.
- Run ComfyUI on dedicated GPU hosts when needed.
- Use S3-compatible object storage for generated artifacts in production.
