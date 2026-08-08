# TECH_STACK — 技术栈文档

## 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.3.0 | App Router 全栈框架 |
| React | 19.2.8 | UI 框架 |
| TypeScript | 5.0.2 | 类型系统 |
| Tailwind CSS | 4 | 原子化 CSS |
| shadcn/ui | latest | UI 组件库（17 个组件） |
| Framer Motion | latest | 动画库 |
| CodeMirror 6 | 6.x | Python 代码编辑器 |
| Zustand | latest | 客户端状态管理 |
| pnpm | 11.x | 包管理器 |

## 后端 / 数据

| 技术 | 用途 |
|------|------|
| Supabase | Auth（邮箱）+ PostgreSQL + Storage + Realtime |
| Drizzle ORM | 数据库 Schema 定义 & 查询 |
| DeepSeek API | AI 代码生成（OpenAI 兼容接口） |
| SSE | 流式 AI 响应 |

## 设计系统

| 元素 | 值 |
|------|-----|
| 主题 | 暗色 forced dark mode |
| 主色 (primary) | `oklch(0.65 0.2 280)` ≈ #7c3aed 紫色 |
| 辅色 (secondary) | `oklch(0.60 0.2 250)` ≈ #3b82f6 蓝色 |
| 强调色 (accent) | `oklch(0.60 0.12 195)` ≈ #06b6d4 青色 |
| 背景 | `oklch(0.13 0.02 265)` 深紫黑 |
| 卡片 | 玻璃态 `glass` / `glass-card` CSS |
| 字体 | Geist (Sans + Mono) |
| 数学公式 | KaTeX (remark-math + rehype-katex) |

## 渲染器

| 技术 | 用途 |
|------|------|
| Python 3.10+ | 渲染器运行时 |
| FastAPI + Uvicorn | API 框架（localhost:9876） |
| Manim Community | 数学动画渲染引擎（v0.19+） |
| Tauri 2.x | 系统托盘包装（需要 Rust 工具链） |
| FFmpeg | 视频编码 |

## 部署

MVP 不部署公网。本地运行：
- `pnpm dev` → Next.js (localhost:3000)
- `renderer/start.bat` → Python FastAPI (localhost:9876)
- Tauri 系统托盘（可选）
