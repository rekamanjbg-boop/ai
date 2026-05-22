import asyncio
import shlex
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from hermes.core.config import Settings
from hermes.domain.models import CodexBridgeRequest, CodexBridgeResult, TaskHistoryRequest
from hermes.infrastructure.redis_client import RedisClient


class CodexBridge:
    def __init__(self, redis: RedisClient, settings: Settings):
        self.redis = redis
        self.settings = settings

    async def run(self, request: CodexBridgeRequest) -> CodexBridgeResult:
        if not self.settings.codex_bridge_enabled:
            raise RuntimeError("Codex bridge is disabled. Set CODEX_BRIDGE_ENABLED=true to enable it.")

        run_id = str(uuid4())
        workspace = Path(self.settings.codex_workspace_root) / run_id
        workspace.mkdir(parents=True, exist_ok=False)

        if request.repo_url:
            await run_command(["git", "clone", "--depth", "1", request.repo_url, "."], workspace, 300)

            if request.base_ref:
                await run_command(["git", "fetch", "origin", request.base_ref, "--depth", "1"], workspace, 300)
                await run_command(["git", "checkout", request.base_ref], workspace, 120)
        else:
            await run_command(["git", "init"], workspace, 120)
            await run_command(["git", "config", "user.email", "codex-bridge@example.local"], workspace, 120)
            await run_command(["git", "config", "user.name", "Codex Bridge"], workspace, 120)
            await write_workspace_files(workspace, request.workspace_files)
            await run_command(["git", "add", "."], workspace, 120)
            await run_command(["git", "commit", "--allow-empty", "-m", "Initial isolated workspace"], workspace, 120)

        await run_command(["git", "config", "--global", "--add", "safe.directory", str(workspace)], workspace, 120)

        if request.branch:
            await run_command(["git", "checkout", "-B", request.branch], workspace, 120)

        prompt = build_codex_prompt(request)
        codex_command = shlex.split(self.settings.codex_cli_command) + [prompt]
        codex_result = await run_command(codex_command, workspace, self.settings.codex_timeout_seconds, check=False)
        patch = await collect_patch(workspace, self.settings.codex_max_patch_bytes)
        review = await review_patch(workspace)
        result = CodexBridgeResult(
            run_id=run_id,
            project_id=request.project_id,
            workspace_path=str(workspace),
            exit_code=codex_result.exit_code,
            patch=patch["text"],
            patch_truncated=patch["truncated"],
            stdout=codex_result.stdout,
            stderr=codex_result.stderr,
            review=review,
        )

        await self.redis.set_json(f"codex:runs:{run_id}", result.model_dump())
        return result


def build_codex_prompt(request: CodexBridgeRequest) -> str:
    return "\n".join([
        request.task,
        "",
        "Constraints:",
        "- Work only inside the current isolated git workspace.",
        "- Do not run destructive git commands.",
        "- Prefer focused patches and leave unrelated files untouched.",
        "- Finish by leaving changes unstaged so git diff captures the patch.",
    ])


async def write_workspace_files(workspace: Path, files: dict[str, str]) -> None:
    for relative_path, content in files.items():
        target = (workspace / relative_path).resolve()

        if not str(target).startswith(str(workspace.resolve())):
            raise ValueError(f"Workspace file escapes isolated workspace: {relative_path}")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


async def collect_patch(workspace: Path, max_bytes: int) -> dict[str, object]:
    result = await run_command(["git", "diff", "--no-ext-diff", "--binary"], workspace, 120, check=False)
    encoded = result.stdout.encode("utf-8")

    if len(encoded) <= max_bytes:
        return {"text": result.stdout, "truncated": False}

    truncated = encoded[:max_bytes].decode("utf-8", errors="ignore")
    return {"text": truncated, "truncated": True}


async def review_patch(workspace: Path) -> dict[str, object]:
    diff_check = await run_command(["git", "diff", "--check"], workspace, 120, check=False)
    status = await run_command(["git", "status", "--short"], workspace, 120, check=False)

    return {
        "status": "passed" if diff_check.exit_code == 0 else "failed",
        "diffCheckExitCode": diff_check.exit_code,
        "diffCheckOutput": diff_check.stdout + diff_check.stderr,
        "gitStatus": status.stdout,
        "reviewedAt": datetime.now(timezone.utc).isoformat(),
    }


class CommandResult:
    def __init__(self, exit_code: int, stdout: str, stderr: str):
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


async def run_command(
    command: list[str],
    cwd: Path,
    timeout_seconds: int,
    check: bool = True,
) -> CommandResult:
    process = await asyncio.create_subprocess_exec(
        *command,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise TimeoutError(f"Command timed out after {timeout_seconds}s: {command[0]}")

    result = CommandResult(
        exit_code=process.returncode,
        stdout=stdout_bytes.decode("utf-8", errors="replace"),
        stderr=stderr_bytes.decode("utf-8", errors="replace"),
    )

    if check and result.exit_code != 0:
        raise RuntimeError(f"Command failed: {command[0]}\n{result.stderr}")

    return result


def codex_task_history(result: CodexBridgeResult) -> TaskHistoryRequest:
    return TaskHistoryRequest(
        project_id=result.project_id,
        task_type="codex.code_review",
        status="completed" if result.exit_code == 0 else "failed",
        payload=result.model_dump(),
    )
