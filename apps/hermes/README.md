# Hermes Orchestration Service

Hermes is an isolated Python orchestration service for planning and coordinating AI media production workflows.

## Responsibilities

- Maintain persistent orchestration memory in Redis.
- Expose a REST bridge for the Node.js API and internal tools.
- Dispatch worker commands through Redis Streams.
- Track workflow plans, stages, and orchestration decisions.
- Run in an isolated virtualenv locally and inside Docker.

## Local Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn hermes.main:app --host 0.0.0.0 --port 8000
```

## REST Bridge

```text
GET  /health
GET  /v1/queues/health
POST /v1/orchestrations
GET  /v1/orchestrations/{orchestration_id}
POST /v1/orchestrations/{orchestration_id}/dispatch
POST /v1/bridge/jobs
GET  /v1/bridge/jobs/{job_id}/status
GET  /v1/memory/{namespace}/{key}
PUT  /v1/memory/{namespace}/{key}
GET  /v1/memory/{namespace}
POST /v1/memory/task-history
GET  /v1/memory/task-history
PUT  /v1/memory/characters/{character_id}
GET  /v1/memory/characters/{character_id}
PUT  /v1/memory/prompts/{prompt_id}
PUT  /v1/memory/workflows/{workflow_id}
POST /v1/codex/runs
```

The bridge endpoints accept Node.js camelCase payloads such as `projectId` and return camelCase identifiers such as `jobId`.

## Persistent Memory

Hermes uses Redis as a hot cache and SQLite as durable storage.

- Task history: append-only SQLite records for completed or planned work.
- Character continuity: namespaced agent memory for recurring characters.
- Prompt memory: reusable prompt context and prompt performance notes.
- Workflow memory: reusable workflow state, plans, and learned parameters.

## Codex Bridge

Hermes can invoke a configured Codex CLI command inside a fresh isolated git workspace.

Safety model:

- Each run gets a new workspace under `CODEX_WORKSPACE_ROOT`.
- Source repos are cloned into the isolated workspace.
- Inline `workspace_files` are written only inside that workspace.
- Patch output is collected with `git diff --no-ext-diff --binary`.
- Review logging runs `git diff --check` and stores the result in task history plus `code-review` memory.
- The bridge is disabled unless `CODEX_BRIDGE_ENABLED=true`.

Example:

```bash
curl -X POST http://localhost:8000/v1/codex/runs \
  -H "content-type: application/json" \
  -d '{"project_id":"demo","task":"Review this repo and produce a small patch","repo_url":"https://github.com/example/repo.git"}'
```
