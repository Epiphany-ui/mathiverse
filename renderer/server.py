"""Mathiverse local FastAPI service for validated, cancellable Manim renders."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from renderer.core import (
        ValidationIssue,
        compute_render_key,
        is_render_cacheable,
        validate_code,
    )
except ModuleNotFoundError:  # Supports `cd renderer && python server.py`.
    from core import (  # type: ignore[no-redef]
        ValidationIssue,
        compute_render_key,
        is_render_cacheable,
        validate_code,
    )


HOST = os.environ.get("RENDER_HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "9876"))
# ffmpeg/ffprobe may live in the venv bin dir (not on PATH when the venv
# wasn't activated).  Resolve them relative to the running interpreter.
_VENV_BIN = Path(sys.executable).parent
_FFMPEG = shutil.which("ffmpeg") or (
    str(_VENV_BIN / "ffmpeg") if (_VENV_BIN / "ffmpeg").is_file() else "ffmpeg"
)
_FFPROBE = shutil.which("ffprobe") or (
    str(_VENV_BIN / "ffprobe") if (_VENV_BIN / "ffprobe").is_file() else "ffprobe"
)
# Public base URL for artifact links returned to clients.  Must be reachable
# from browsers / Next.js server.  Resolution order:
#   1. RENDERER_PUBLIC_URL (explicit override)
#   2. RENDER_EXTERNAL_URL (auto-set by Render.com — includes https:// prefix)
#   3. http://127.0.0.1:{PORT} (local dev fallback)
_PUBLIC = os.environ.get("RENDERER_PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL")
PUBLIC_URL = _PUBLIC.rstrip("/") if _PUBLIC else f"http://127.0.0.1:{PORT}"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "mathiverse-renderer"
STAGING_DIR = OUTPUT_DIR / ".staging"
MANIM_TIMEOUT = 120
MAX_CODE_SIZE = 50_000
MAX_ERROR_DETAIL = 6_000
VALID_QUALITIES = frozenset({"-ql", "-qm", "-qh", "-qk"})
VALID_FORMATS = frozenset({"mp4", "gif"})

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
STAGING_DIR.mkdir(parents=True, exist_ok=True)

LOGGER = logging.getLogger("mathiverse.renderer")
ACTIVE_PROCESSES: dict[str, subprocess.Popen[str]] = {}
ACTIVE_PROCESSES_LOCK = threading.Lock()
CANCELLED_REQUESTS: set[str] = set()


class _KeyLockEntry:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.users = 0


KEY_LOCKS: dict[str, _KeyLockEntry] = {}
KEY_LOCKS_GUARD = asyncio.Lock()


app = FastAPI(
    title="Mathiverse Renderer",
    description="Local Manim rendering service for Mathiverse",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")


class ValidationIssueModel(BaseModel):
    code: str
    message: str
    line: int | None = None
    column: int | None = None


class ValidationRequest(BaseModel):
    code: str


class ValidationResponse(BaseModel):
    valid: bool
    scene_name: str | None = None
    issues: list[ValidationIssueModel] = Field(default_factory=list)


class RenderRequest(BaseModel):
    code: str
    quality: str = "-ql"
    format: str = "mp4"
    request_id: str = Field(min_length=1, max_length=128)


class RenderResponse(BaseModel):
    success: bool
    video_url: str | None = None
    gif_url: str | None = None
    poster_url: str | None = None
    duration: float | None = None
    error: str | None = None
    diagnostics: list[ValidationIssueModel] = Field(default_factory=list)
    scene_name: str | None = None
    render_key: str | None = None
    cache_hit: bool = False


class HealthResponse(BaseModel):
    status: str
    manim_version: str | None = None
    python_version: str
    platform: str


def _issue_model(issue: ValidationIssue) -> ValidationIssueModel:
    return ValidationIssueModel(
        code=issue.code,
        message=issue.message,
        line=issue.line,
        column=issue.column,
    )


@lru_cache(maxsize=1)
def get_manim_version() -> str | None:
    """Return the installed Manim version without spawning per request."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "manim", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    output = (result.stdout or result.stderr).strip()
    match = re.search(r"(\d+\.\d+(?:\.\d+)?(?:[-+._a-zA-Z0-9]*)?)", output)
    return match.group(1) if match else output or None


def _cached_path(render_key: str, scene_name: str, fmt: str) -> Path:
    return OUTPUT_DIR / render_key / f"{scene_name}.{fmt}"


def _poster_path(video_path: Path) -> Path:
    return video_path.with_suffix(".poster.jpg")


def _generate_poster(video_path: Path) -> Path | None:
    """Extract a representative frame from the video as a JPEG poster.

    Manim scenes usually start with a black fade-in, so the last frame
    (0.5s before the end via -sseof) shows the complete scene.
    Skips regeneration when the poster already exists (cache hits).
    """
    poster = _poster_path(video_path)
    if poster.is_file():
        return poster
    try:
        result = subprocess.run(
            [
                _FFMPEG,
                "-y",
                "-sseof",
                "-0.5",
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                "-q:v",
                "3",
                str(poster),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0 or not poster.is_file():
            # Fallback: midpoint frame for very short or odd videos
            duration = estimate_duration(video_path) or 2.0
            at = max(0.0, duration * 0.5)
            result = subprocess.run(
                [
                    _FFMPEG,
                    "-y",
                    "-ss",
                    f"{at:.2f}",
                    "-i",
                    str(video_path),
                    "-frames:v",
                    "1",
                    "-q:v",
                    "3",
                    str(poster),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
        if result.returncode != 0 or not poster.is_file():
            LOGGER.warning("Poster generation failed: %s", (result.stderr or "")[:300])
            return None
        return poster
    except (OSError, subprocess.SubprocessError):
        return None


def _artifact_response(
    path: Path,
    fmt: str,
    scene_name: str,
    render_key: str,
    *,
    cache_hit: bool,
) -> RenderResponse:
    relative = path.relative_to(OUTPUT_DIR).as_posix()
    url = f"{PUBLIC_URL}/output/{relative}"

    # Generate/refresh the poster alongside the video (mp4 only).
    poster_url: str | None = None
    if fmt == "mp4":
        poster = _generate_poster(path)
        if poster is not None:
            poster_rel = poster.relative_to(OUTPUT_DIR).as_posix()
            poster_url = f"{PUBLIC_URL}/output/{poster_rel}"

    return RenderResponse(
        success=True,
        video_url=url if fmt == "mp4" else None,
        gif_url=url if fmt == "gif" else None,
        poster_url=poster_url,
        duration=estimate_duration(path),
        scene_name=scene_name,
        render_key=render_key,
        cache_hit=cache_hit,
    )


def _sanitize_detail(detail: str, staging_dir: Path) -> str:
    clean = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", detail)
    replacements = {
        str(staging_dir): "<render-workspace>",
        str(OUTPUT_DIR): "<render-output>",
        tempfile.gettempdir(): "<temp>",
    }
    for value, replacement in sorted(replacements.items(), key=lambda item: -len(item[0])):
        clean = clean.replace(value, replacement)
    clean = clean.strip()
    if len(clean) > MAX_ERROR_DETAIL:
        clean = "[technical detail truncated]\n" + clean[-MAX_ERROR_DETAIL:]
    return clean


def _render_diagnostic(detail: str) -> ValidationIssueModel:
    line_match = re.search(r"scene\.py[^\n]*?line\s+(\d+)", detail, re.IGNORECASE)
    return ValidationIssueModel(
        code="render",
        message="Manim could not render this scene.",
        line=int(line_match.group(1)) if line_match else None,
    )


def _register_process(request_id: str, process: subprocess.Popen[str]) -> bool:
    with ACTIVE_PROCESSES_LOCK:
        if request_id in ACTIVE_PROCESSES:
            return False
        ACTIVE_PROCESSES[request_id] = process
        return True


def _unregister_process(request_id: str, process: subprocess.Popen[str]) -> bool:
    with ACTIVE_PROCESSES_LOCK:
        if ACTIVE_PROCESSES.get(request_id) is not process:
            return False
        cancelled = request_id in CANCELLED_REQUESTS
        CANCELLED_REQUESTS.discard(request_id)
        ACTIVE_PROCESSES.pop(request_id, None)
        return cancelled


def _cancel_process(request_id: str) -> bool:
    with ACTIVE_PROCESSES_LOCK:
        process = ACTIVE_PROCESSES.get(request_id)
        if process is None:
            return False
        CANCELLED_REQUESTS.add(request_id)
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
    return True


@asynccontextmanager
async def _render_key_lock(render_key: str):
    async with KEY_LOCKS_GUARD:
        entry = KEY_LOCKS.setdefault(render_key, _KeyLockEntry())
        entry.users += 1
    acquired = False
    try:
        await entry.lock.acquire()
        acquired = True
        yield
    finally:
        if acquired:
            entry.lock.release()
        async with KEY_LOCKS_GUARD:
            entry.users -= 1
            if entry.users == 0 and KEY_LOCKS.get(render_key) is entry:
                KEY_LOCKS.pop(render_key, None)


def _find_rendered_file(staging_dir: Path, scene_name: str, fmt: str) -> Path | None:
    candidates = list((staging_dir / "media").rglob(f"*.{fmt}"))
    exact = next((path for path in candidates if path.stem == scene_name), None)
    return exact or (candidates[0] if candidates else None)


def _publish_artifact(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
    try:
        shutil.copy2(source, temporary)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def _render_manim_blocking(
    code: str,
    quality: str,
    fmt: str,
    request_id: str,
    scene_name: str,
    render_key: str,
    destination: Path,
) -> RenderResponse:
    staging_dir = Path(tempfile.mkdtemp(prefix=f"{render_key}-", dir=STAGING_DIR))
    code_file = staging_dir / "scene.py"
    code_file.write_text(code.replace("\r\n", "\n"), encoding="utf-8")
    command = [
        sys.executable,
        "-m",
        "manim",
        str(code_file),
        scene_name,
        quality,
        "--format",
        fmt,
    ]
    process: subprocess.Popen[str] | None = None
    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=staging_dir,
        )
        if not _register_process(request_id, process):
            process.terminate()
            process.wait(timeout=3)
            return RenderResponse(
                success=False,
                error="该 request_id 已有渲染任务正在运行。",
                diagnostics=[ValidationIssueModel(code="request", message="Duplicate active request_id.")],
                scene_name=scene_name,
                render_key=render_key,
            )

        try:
            stdout, stderr = process.communicate(timeout=MANIM_TIMEOUT)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                stdout, stderr = process.communicate(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
            detail = stderr or stdout or "Manim timed out without diagnostic output."
            LOGGER.error("Manim render timed out for key %s:\n%s", render_key, detail)
            clean = _sanitize_detail(detail, staging_dir)
            return RenderResponse(
                success=False,
                error=f"渲染超时（{MANIM_TIMEOUT}秒）。\n{clean}",
                diagnostics=[ValidationIssueModel(code="timeout", message="Manim render timed out.")],
                scene_name=scene_name,
                render_key=render_key,
            )

        returncode = process.returncode
        cancelled = _unregister_process(request_id, process)
        process = None
        if cancelled:
            return RenderResponse(
                success=False,
                error="渲染已取消。",
                diagnostics=[ValidationIssueModel(code="cancelled", message="Render was cancelled.")],
                scene_name=scene_name,
                render_key=render_key,
            )
        if returncode != 0:
            detail = stderr or stdout or f"Manim exited with status {returncode}."
            LOGGER.error("Manim render failed for key %s:\n%s", render_key, detail)
            clean = _sanitize_detail(detail, staging_dir)
            return RenderResponse(
                success=False,
                error=f"Manim 渲染失败。\n{clean}",
                diagnostics=[_render_diagnostic(detail)],
                scene_name=scene_name,
                render_key=render_key,
            )

        rendered = _find_rendered_file(staging_dir, scene_name, fmt)
        if rendered is None:
            detail = stderr or stdout or "Manim produced no output file."
            LOGGER.error("Manim produced no output for key %s:\n%s", render_key, detail)
            clean = _sanitize_detail(detail, staging_dir)
            return RenderResponse(
                success=False,
                error=f"渲染完成但未找到输出文件。\n{clean}",
                diagnostics=[_render_diagnostic(detail)],
                scene_name=scene_name,
                render_key=render_key,
            )

        _publish_artifact(rendered, destination)
        return _artifact_response(
            destination,
            fmt,
            scene_name,
            render_key,
            cache_hit=False,
        )
    except OSError as exc:
        LOGGER.exception("Failed to launch or publish Manim render for key %s", render_key)
        clean = _sanitize_detail(str(exc), staging_dir)
        return RenderResponse(
            success=False,
            error=f"无法启动 Manim 渲染器：{clean}",
            diagnostics=[ValidationIssueModel(code="environment", message="Manim could not be started.")],
            scene_name=scene_name,
            render_key=render_key,
        )
    finally:
        if process is not None:
            _unregister_process(request_id, process)
            if process.poll() is None:
                process.kill()
                process.wait(timeout=3)
        shutil.rmtree(staging_dir, ignore_errors=True)


def estimate_duration(filepath: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                _FFPROBE,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(filepath),
            ],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return float(json.loads(result.stdout)["format"]["duration"])
    except (OSError, ValueError, KeyError, json.JSONDecodeError, subprocess.SubprocessError):
        return None


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    version = await asyncio.to_thread(get_manim_version)
    return HealthResponse(
        status="ok" if version else "manim_not_installed",
        manim_version=version,
        python_version=sys.version,
        platform=sys.platform,
    )


@app.post("/validate", response_model=ValidationResponse)
async def validate(request: ValidationRequest) -> ValidationResponse:
    if len(request.code) > MAX_CODE_SIZE:
        return ValidationResponse(
            valid=False,
            issues=[ValidationIssueModel(code="size", message=f"Code exceeds {MAX_CODE_SIZE} characters.")],
        )
    result = await asyncio.to_thread(validate_code, request.code)
    return ValidationResponse(
        valid=result.valid,
        scene_name=result.scene_name,
        issues=[_issue_model(issue) for issue in result.issues],
    )


@app.post("/render", response_model=RenderResponse)
async def render(request: RenderRequest) -> RenderResponse:
    if len(request.code) > MAX_CODE_SIZE:
        return RenderResponse(success=False, error=f"代码超过最大长度限制（{MAX_CODE_SIZE}字符）。")
    if request.format not in VALID_FORMATS:
        return RenderResponse(success=False, error="不支持的输出格式。请使用 mp4 或 gif。")
    if request.quality not in VALID_QUALITIES:
        return RenderResponse(success=False, error="不支持的质量参数。请使用 -ql、-qm、-qh 或 -qk。")

    validation = await asyncio.to_thread(validate_code, request.code)
    diagnostics = [_issue_model(issue) for issue in validation.issues]
    if not validation.valid or validation.scene_name is None:
        return RenderResponse(
            success=False,
            error=diagnostics[0].message if diagnostics else "代码验证失败。",
            diagnostics=diagnostics,
            scene_name=validation.scene_name,
        )

    manim_version = await asyncio.to_thread(get_manim_version)
    if manim_version is None:
        return RenderResponse(
            success=False,
            error="Manim 未安装。请参考 renderer/README.md 安装。",
            diagnostics=[ValidationIssueModel(code="environment", message="Manim is not installed.")],
            scene_name=validation.scene_name,
        )

    render_key = compute_render_key(
        request.code,
        request.quality,
        request.format,
        manim_version,
    )
    cacheable = is_render_cacheable(request.code)
    stable_path = _cached_path(render_key, validation.scene_name, request.format)

    async with _render_key_lock(render_key):
        if cacheable and await asyncio.to_thread(stable_path.is_file):
            return await asyncio.to_thread(
                _artifact_response,
                stable_path,
                request.format,
                validation.scene_name,
                render_key,
                cache_hit=True,
            )

        if cacheable:
            destination = stable_path
        else:
            destination = (
                OUTPUT_DIR
                / "volatile"
                / uuid.uuid4().hex
                / f"{validation.scene_name}.{request.format}"
            )
        return await asyncio.to_thread(
            _render_manim_blocking,
            request.code,
            request.quality,
            request.format,
            request.request_id,
            validation.scene_name,
            render_key,
            destination,
        )


@app.delete("/render/{request_id}")
async def cancel_render(request_id: str) -> dict[str, bool]:
    return {"cancelled": await asyncio.to_thread(_cancel_process, request_id)}


@app.get("/outputs")
async def list_outputs() -> dict[str, list[dict[str, str | int]]]:
    def collect() -> list[dict[str, str | int]]:
        files = []
        for path in OUTPUT_DIR.rglob("*"):
            if not path.is_file() or STAGING_DIR in path.parents:
                continue
            relative = path.relative_to(OUTPUT_DIR).as_posix()
            files.append(
                {
                    "name": relative,
                    "size": path.stat().st_size,
                    "url": f"{PUBLIC_URL}/output/{relative}",
                }
            )
        return files

    return {"files": await asyncio.to_thread(collect)}


if __name__ == "__main__":
    import uvicorn

    print("=" * 56)
    print("  Mathiverse Local Renderer")
    print(f"  Listening: http://{HOST}:{PORT}")
    print(f"  Public URL: {PUBLIC_URL}")
    print(f"  Output dir: {OUTPUT_DIR}")
    print("=" * 56)
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
