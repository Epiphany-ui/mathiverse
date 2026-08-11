# TECH_STACK — 技术栈文档

## 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.3.0 | App Router 全栈框架 |
| React | 19.2.8 | UI 框架 |
| TypeScript | ^5 | 类型系统 |
| Tailwind CSS | 4 | 原子化 CSS |
| shadcn/ui | ^4.16 | UI 组件库（基于 @base-ui/react） |
| tw-animate-css | ^1.4 | CSS 动画 |
| CodeMirror 6 | 6.x | Python 代码编辑器 |
| next-themes | ^0.4 | 亮色/暗色主题切换 |
| pnpm | 11.x | 包管理器 |

## 后端 / 数据

| 技术 | 用途 |
|------|------|
| Supabase | Auth（邮箱 + GitHub OAuth）+ PostgreSQL + pgvector + Storage |
| Drizzle ORM | 数据库 Schema 定义 |
| DeepSeek API | AI 代码生成（OpenAI 兼容接口） |
| SSE | 流式 AI 响应 |

## 设计系统

| 元素 | 值 |
|------|-----|
| 主题 | 暖奶油色系（light/dark 切换，next-themes） |
| 主色 (primary) | `#cc785c` 珊瑚橙 |
| 背景 (dark) | `#181715` 暖黑 |
| 前景 (light) | `#faf9f5` 奶油白 |
| 卡片 | 玻璃态 `GlassCard` + 粒子背景 |
| 正文字体 | Inter（UI）、Cormorant Garamond（标题） |
| 代码字体 | JetBrains Mono |
| 中文字体 | Noto Sans SC |
| 数学公式 | KaTeX (remark-math + rehype-katex) |
| 图标 | lucide-react |

## 渲染器

| 技术 | 用途 |
|------|------|
| Python 3.10+ | 渲染器运行时 |
| FastAPI + Uvicorn | API 框架（localhost:9876） |
| Manim Community | 数学动画渲染引擎（v0.19+） |
| Tauri 2.x | 系统托盘包装（需要 Rust 工具链） |
| FFmpeg | 视频编码 |

## 额外依赖

| 技术 | 用途 |
|------|------|
| sonner | Toast 通知 |
| react-markdown | Markdown 渲染 |
| remark-math + rehype-katex | 数学公式 |
| clsx + class-variance-authority + tailwind-merge | CSS 工具 |
| drizzle-kit | 数据库迁移 CLI |

## 数据库扩展

| 扩展 | 用途 |
|------|------|
| pgvector | 向量相似度搜索（RAG 示例检索） |
| wiki_entries / wiki_edges | 数学百科知识图谱 |
| notifications（DB triggers） | 点赞/评论/关注/Fork 通知 |

## 测试

| 技术 | 用途 |
|------|------|
| Node 原生 test runner | 单元测试 |
| tsx | TypeScript 执行（路径别名解析） |
| Playwright（规划中） | E2E 测试 |

## 部署

MVP 不部署公网。本地运行：
- `pnpm dev` → Next.js (localhost:3000)
- `renderer/start.bat` → Python FastAPI (localhost:9876)
- Tauri 系统托盘（可选）
