"""
Mathiverse Local Renderer — FastAPI server for Manim rendering.

Usage:
    pip install -r requirements.txt
    python server.py

The server starts on http://localhost:9876.
The Next.js app proxies /api/render to this server.

Endpoints:
    GET  /health          — Check renderer status
    POST /render          — Render Manim code, return video
    GET  /output/{file}   — Serve rendered files
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ─── Config ────────────────────────────────────────────────────────────

HOST = "127.0.0.1"
PORT = 9876
OUTPUT_DIR = Path(tempfile.gettempdir()) / "mathiverse-renderer"
MANIM_TIMEOUT = 120  # seconds
MAX_CODE_SIZE = 50_000  # characters

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Mathiverse Renderer",
    description="Local Manim rendering service for Mathiverse",
    version="0.1.0",
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

# Mount output directory for serving rendered files
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")


# ─── Models ────────────────────────────────────────────────────────────

class RenderRequest(BaseModel):
    code: str
    quality: str = "-ql"  # -ql, -qm, -qh, -qk
    format: str = "mp4"    # mp4 or gif


class RenderResponse(BaseModel):
    success: bool
    video_url: str | None = None
    gif_url: str | None = None
    duration: float | None = None
    error: str | None = None
    scene_name: str | None = None


class HealthResponse(BaseModel):
    status: str
    manim_version: str | None = None
    python_version: str
    platform: str


# ─── Helpers ───────────────────────────────────────────────────────────

def get_manim_version() -> str | None:
    """Get installed Manim version."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "manim", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip() or result.stderr.strip()
    except Exception:
        return None


def check_manim_installed() -> bool:
    """Check if Manim is installed and importable."""
    try:
        subprocess.run(
            [sys.executable, "-c", "import manim"],
            capture_output=True,
            timeout=10,
        )
        return True
    except Exception:
        return False


def extract_scene_name(code: str) -> str | None:
    """Extract the Scene class name from Manim code."""
    import re

    match = re.search(r"class\s+(\w+)\s*\(\s*(?:ThreeD)?Scene\s*\)", code)
    return match.group(1) if match else None


def render_manim(code: str, quality: str, fmt: str) -> RenderResponse:
    """Render Manim code and return the output file info."""
    if not check_manim_installed():
        return RenderResponse(
            success=False,
            error=(
                "Manim 未安装。请运行: pip install manim\n"
                "或参考 renderer/README.md 安装指南。"
            ),
        )

    scene_name = extract_scene_name(code)
    if not scene_name:
        return RenderResponse(
            success=False,
            error="未找到 Scene 类。请确保代码中包含类似 'class MyScene(Scene):' 的定义。",
        )

    # Create a unique job directory
    job_hash = hashlib.sha256(
        (code + quality + fmt + str(time.time())).encode()
    ).hexdigest()[:12]
    job_dir = OUTPUT_DIR / job_hash
    job_dir.mkdir(parents=True, exist_ok=True)

    # Write the code file
    code_file = job_dir / "scene.py"
    code_file.write_text(code, encoding="utf-8")

    try:
        # Run manim
        quality_flag = quality
        if fmt == "gif":
            quality_flag += " --format=gif"

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "manim",
                str(code_file),
                scene_name,
                quality_flag,
            ],
            capture_output=True,
            text=True,
            timeout=MANIM_TIMEOUT,
            cwd=str(job_dir),
        )

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout
            # Extract the most useful part of the error
            lines = error_msg.strip().split("\n")
            key_lines = [
                l
                for l in lines
                if "Error" in l or "error" in l or "Traceback" in l
            ]
            short_error = (
                "\n".join(key_lines[-3:])
                if key_lines
                else lines[-1] if lines else "Unknown error"
            )
            return RenderResponse(
                success=False,
                error=f"Manim 渲染失败:\n{short_error}",
                scene_name=scene_name,
            )

        # Locate the output file
        media_dir = job_dir / "media"
        video_dir = None

        # Manim output structure: media/videos/scene/QUALITY/
        for root, dirs, files in os.walk(str(media_dir)):
            for f in files:
                if f.endswith(f".{fmt}"):
                    video_dir = Path(root)
                    break
            if video_dir:
                break

        if not video_dir:
            return RenderResponse(
                success=False,
                error="渲染完成但未找到输出文件。请检查代码是否正确。",
                scene_name=scene_name,
            )

        output_file = video_dir / f"{scene_name}.{fmt}"
        if not output_file.exists():
            # Try to find any output file
            candidates = list(video_dir.glob(f"*.{fmt}"))
            if candidates:
                output_file = candidates[0]
            else:
                return RenderResponse(
                    success=False,
                    error=f"未找到 .{fmt} 输出文件。检查渲染参数。",
                    scene_name=scene_name,
                )

        # Copy to a stable location
        final_name = f"{job_hash}_{scene_name}.{fmt}"
        final_path = OUTPUT_DIR / final_name
        shutil.copy2(output_file, final_path)

        # Clean up job directory
        shutil.rmtree(job_dir, ignore_errors=True)

        video_url = f"http://{HOST}:{PORT}/output/{final_name}"
        duration = estimate_duration(final_path)

        return RenderResponse(
            success=True,
            video_url=video_url if fmt == "mp4" else None,
            gif_url=video_url if fmt == "gif" else None,
            duration=duration,
            scene_name=scene_name,
        )

    except subprocess.TimeoutExpired:
        shutil.rmtree(job_dir, ignore_errors=True)
        return RenderResponse(
            success=False,
            error=f"渲染超时（{MANIM_TIMEOUT}秒）。代码可能过于复杂。",
            scene_name=scene_name,
        )
    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        return RenderResponse(
            success=False,
            error=f"渲染时发生异常: {str(e)}",
            scene_name=scene_name,
        )


def estimate_duration(filepath: Path) -> float | None:
    """Estimate video duration using ffprobe if available."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
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
        )
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception:
        return None


# ─── Routes ────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok" if check_manim_installed() else "manim_not_installed",
        manim_version=get_manim_version(),
        python_version=sys.version,
        platform=sys.platform,
    )


@app.post("/render", response_model=RenderResponse)
async def render(request: RenderRequest):
    """Render Manim code and return video URL."""
    if len(request.code) > MAX_CODE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"代码超过最大长度限制 ({MAX_CODE_SIZE} 字符)。",
        )

    if request.format not in ("mp4", "gif"):
        raise HTTPException(
            status_code=400,
            detail="不支持的输出格式。请使用 'mp4' 或 'gif'。",
        )

    if request.quality not in ("-ql", "-qm", "-qh", "-qk"):
        raise HTTPException(
            status_code=400,
            detail="不支持的质量参数。请使用 -ql, -qm, -qh, 或 -qk。",
        )

    result = render_manim(request.code, request.quality, request.format)
    if not result.success:
        raise HTTPException(status_code=422, detail=result.error)

    return result


@app.get("/outputs")
async def list_outputs():
    """List all rendered outputs (for cleanup)."""
    files = []
    for f in OUTPUT_DIR.iterdir():
        if f.is_file():
            files.append(
                {
                    "name": f.name,
                    "size": f.stat().st_size,
                    "url": f"http://{HOST}:{PORT}/output/{f.name}",
                }
            )
    return {"files": files}


# ─── Main ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    print("=" * 56)
    print("  Mathiverse Local Renderer")
    print(f"  http://{HOST}:{PORT}")
    print(f"  Output dir: {OUTPUT_DIR}")
    print("=" * 56)

    if not check_manim_installed():
        print("\n⚠️  警告: Manim 未安装!")
        print("  请运行: pip install manim")
        print("  渲染功能将不可用。\n")

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
