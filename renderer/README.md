# Mathiverse Local Renderer

本地 Manim 渲染服务。Next.js 前端通过 `/api/render` 代理到此服务。

## 快速启动

### Windows
双击 `start.bat`，或：
```bash
cd renderer
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

### macOS / Linux
```bash
cd renderer
chmod +x start.sh
./start.sh
```

服务启动在 `http://localhost:9876`。

## 依赖

| 依赖 | 说明 |
|------|------|
| Python 3.10+ | 运行环境 |
| Manim Community v0.19+ | 渲染引擎 |
| FastAPI + Uvicorn | API 框架 |
| FFmpeg (推荐) | 视频编码，提取时长 |

### 安装 FFmpeg

- **Windows**: `winget install ffmpeg` 或从 [ffmpeg.org](https://ffmpeg.org) 下载
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` / `sudo dnf install ffmpeg`

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查，返回 Manim 版本 |
| `POST` | `/render` | 渲染 Manim 代码 |
| `GET` | `/output/{file}` | 获取渲染输出文件 |

### POST /render

```json
{
  "code": "from manim import *\n\nclass MyScene(Scene):\n    ...",
  "quality": "-ql",
  "format": "mp4"
}
```

返回：
```json
{
  "success": true,
  "video_url": "http://localhost:9876/output/abc123_MyScene.mp4",
  "duration": 5.2,
  "scene_name": "MyScene"
}
```

## Tauri 系统托盘

需要 Rust 工具链。安装后：

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 构建 Tauri 应用
pnpm tauri build

# 开发模式
pnpm tauri dev
```

Tauri 应用会在系统托盘中显示图标，左键点击切换渲染器开关，右键显示菜单。

## 环境变量

在项目根目录 `.env.local` 中配置：

```
NEXT_PUBLIC_RENDERER_URL=http://localhost:9876
```
