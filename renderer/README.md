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

服务启动在 `http://127.0.0.1:9876`。

## 依赖

| 依赖 | 说明 |
|------|------|
| Python 3.10+ | 运行环境，也是渲染缓存环境指纹的一部分 |
| Manim Community v0.19+ | 渲染引擎 |
| FastAPI + Uvicorn | API 框架 |
| FFmpeg（推荐） | 视频编码与时长提取 |

### 安装 FFmpeg

- **Windows**: `winget install ffmpeg` 或从 [ffmpeg.org](https://ffmpeg.org) 下载
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` / `sudo dnf install ffmpeg`

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查，返回 Manim 与 Python 版本 |
| `POST` | `/validate` | 只做 AST 校验和 Scene 发现，绝不执行用户代码 |
| `POST` | `/render` | 重新校验后渲染；支持稳定缓存与结构化诊断 |
| `DELETE` | `/render/{request_id}` | 终止对应的活动 Manim 子进程 |
| `GET` | `/output/{path}` | 获取渲染输出文件 |

### POST /validate

```bash
curl -X POST http://127.0.0.1:9876/validate \
  -H 'Content-Type: application/json' \
  -d '{"code":"from manim import *\nclass Demo(Scene):\n    pass"}'
```

成功发现 Scene：

```json
{
  "valid": true,
  "scene_name": "Demo",
  "issues": []
}
```

语法、安全或 Scene 错误会以 `issues` 返回；每项包含 `code`、`message`，并在可用时包含 `line`、`column`。

### POST /render

每次请求必须提供唯一的 `request_id`：

```json
{
  "code": "from manim import *\nclass Demo(Scene):\n    def construct(self):\n        self.add(Circle())",
  "quality": "-ql",
  "format": "mp4",
  "request_id": "studio-01JXYZ"
}
```

成功响应：

```json
{
  "success": true,
  "video_url": "http://127.0.0.1:9876/output/91f0.../Demo.mp4",
  "gif_url": null,
  "duration": 0.07,
  "error": null,
  "diagnostics": [],
  "scene_name": "Demo",
  "render_key": "91f0...",
  "cache_hit": false
}
```

确定性场景的缓存键由规范化代码、quality、format、Manim 版本、Python 主次版本和缓存 schema 共同生成，不包含请求 ID、时间或临时路径。相同输入再次请求会得到同一 `render_key`，且 `cache_hit` 为 `true`。quality 与 format 始终作为独立 CLI 参数传给 Manim。

显式使用 `random` 或 `numpy` 的场景会保守地绕过共享缓存，每次发布独立产物，避免把随机结果错误复用给另一请求。渲染先在 staging 目录完成，只有成功产物才会原子发布；失败、超时或取消都会清理 staging，不能形成缓存命中。

失败响应仍使用同一 JSON 结构，`success` 为 `false`；`diagnostics` 提供简洁的机器可读问题，`error` 提供有长度上限并已移除临时绝对路径的技术细节。服务端日志保留完整 Manim 输出供本地排查。

### 取消渲染

```bash
curl -X DELETE http://127.0.0.1:9876/render/studio-01JXYZ
```

响应 `{"cancelled":true}` 表示已向活动子进程发送终止信号；任务不存在或已完成时为 `false`。等待同一缓存键的请求不持有 Manim 子进程，取消它不会误杀正在渲染的 leader。

## 安全边界

AST 校验只允许导入 `manim`、`numpy`、`math`、`random`、`statistics`，并阻止明显的进程、文件、网络和动态执行入口。它是纵深防御，不是安全沙箱。生产环境必须继续使用无网络、只读根文件系统、临时工作目录、非 root 用户，以及 CPU、内存、进程数和执行时长限制的独立 renderer 容器。

## Tauri 系统托盘

需要 Rust 工具链。安装后：

```bash
pnpm tauri build
pnpm tauri dev
```

## 环境变量

在项目根目录 `.env.local` 中配置：

```dotenv
NEXT_PUBLIC_RENDERER_URL=http://127.0.0.1:9876
```
