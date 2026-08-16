# Mathiverse

数学可视化社区平台。用户用自然语言描述数学概念，平台通过 AI 生成 Manim 代码并渲染为动画，动画可发布到社区，供浏览、讨论、收藏与 Fork。

目前已上线测试版本至https://mathiverse-kappa.vercel.app/

## 功能

- **社区画廊**：首页视频轮播、Feed 流（热门 / 最新 / 关注）、发现页、全文搜索
- **AI 沙箱**：CodeMirror 6 Python 编辑器、DeepSeek 流式对话、代码生成、版本管理（保存、回滚）、本地渲染
- **数学百科**：词条库（纯数学 / 应用数学 / 计算机交叉）、KaTeX 公式、知识图谱、选中词条内文字即可生成对应动画
- **内容发布**：可视化（视频 + 海报）、文章（Markdown + KaTeX）、标签体系
- **社交**：点赞、收藏、Fork（保留溯源链）、嵌套评论、关注、通知
- **用户系统**：邮箱注册登录、GitHub OAuth、资料设置、管理后台

## 技术栈

| 层 | 选型 |
| --- | --- |
| Web 前端 | Next.js 16.3（App Router）、React 19、TypeScript、Tailwind CSS 4 |
| 编辑器 | CodeMirror 6（Python） |
| 公式 | KaTeX |
| 数据与认证 | Supabase（Postgres + RLS、Auth、Storage、pgvector） |
| AI | DeepSeek API（OpenAI 兼容接口），可选本地 Ollama 嵌入用于 RAG |
| 渲染服务 | Python 3.10+、FastAPI、Manim Community v0.21、FFmpeg |

## 目录结构

```
src/app              页面与 API 路由（App Router）
src/components       组件
src/lib              业务逻辑（AI、生成编排、渲染客户端、数据库查询）
supabase/migrations  数据库迁移，按文件名顺序执行
renderer             Manim 渲染服务（FastAPI，独立部署）
scripts              种子数据与维护脚本
e2e                  Playwright 浏览器测试
docs                 产品与技术文档
```

## 快速开始

前置依赖：Node.js ≥ 20.9、pnpm 11、Python 3.10+、FFmpeg。

1. 安装依赖并配置环境变量：

```bash
cp .env.example .env.local
pnpm install
```

按需填写 `.env.local`，变量说明见下文。

2. 启动前端：

```bash
pnpm dev
```

3. 另开终端，启动本地渲染服务：

```bash
cd renderer
./start.sh          # macOS / Linux；Windows 使用 start.bat
```

渲染服务监听 `http://127.0.0.1:9876`。未启动渲染服务时，沙箱仍可编辑和生成代码，但无法渲染。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | service_role key，用于管理后台与种子脚本 |
| `GENERATION_SESSION_SECRET` | 是 | 生成任务会话归属密钥，至少 32 字节随机串 |
| `DEEPSEEK_API_KEY` | AI 功能 | DeepSeek API key；未配置时 AI 生成不可用 |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com` |
| `NEXT_PUBLIC_RENDERER_URL` | 否 | 浏览器侧渲染代理目标，默认 `http://localhost:9876` |
| `RENDERER_URL` | 否 | 服务端直连渲染器的地址，默认同 `NEXT_PUBLIC_RENDERER_URL` |
| `OLLAMA_URL` / `EMBED_MODEL` | 否 | 本地 Ollama 嵌入服务，用于生成时的 RAG 检索（默认模型 `bge-m3`） |
| `WIKI_ADMIN_TOKEN` | 否 | 百科词条导入接口的访问令牌 |

## 数据库迁移

迁移文件位于 `supabase/migrations/`。新项目按文件名顺序全部执行；已有项目只执行尚未应用的部分。在 Supabase SQL Editor 中逐文件运行即可。迁移 018、019 是幂等的，重复执行安全。019 收紧了 RLS 与通知触发器，并添加了删除内容时的关联数据清理。

## 渲染服务

渲染器是独立的 FastAPI 服务，前端通过 `/api/render` 代理到它。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 Manim 与 Python 版本 |
| POST | `/validate` | AST 校验与 Scene 发现，不执行用户代码 |
| POST | `/render` | 渲染，支持稳定缓存 |
| DELETE | `/render/{request_id}` | 终止正在进行的渲染 |
| GET | `/output/{path}` | 获取渲染产物 |

安全模型：仅允许导入 `manim`、`numpy`、`math`、`random`、`statistics`，并阻止进程、文件、网络与动态执行入口。该校验是纵深防御而非沙箱；生产渲染服务应运行在无网络、只读根文件系统、非 root、带资源限制的独立容器中，`renderer/Dockerfile` 已按此构建。

`/api/render`、`/api/chat`、`/api/generation/jobs` 均要求登录，未登录用户无法消耗 AI 与渲染配额。

Docker 运行：

```bash
cd renderer
docker build -t mathiverse-renderer .
docker run -p 9876:9876 mathiverse-renderer
```

`RENDERER_PUBLIC_URL` 指定对外的公网地址（如 `https://renderer.example.com`），未设置时回退到 `http://127.0.0.1:{PORT}`；它只影响返回给前端的视频 URL，不影响监听地址。

## 测试

```bash
pnpm check         # 单元测试、渲染器测试、类型检查、lint、生产构建
pnpm test          # 前端单元测试
pnpm test:renderer # 渲染器 Python 测试
pnpm test:e2e      # Playwright 多视口浏览器测试
```

生成链路冒烟测试（需要可访问的部署环境）：

```bash
GENERATION_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-generation-flow.mjs
```

## 部署

- **前端**：Vercel。设置 `NEXT_PUBLIC_RENDERER_URL` 指向渲染服务的公网地址。
- **渲染服务**：Render.com。`render.yaml` 已配置（Docker 构建，健康检查 `/health`），在 Render 控制台设置 `RENDERER_PUBLIC_URL`。
- **数据**：Supabase。部署后按顺序执行 `supabase/migrations/` 中未应用的迁移。

## 文档

产品与设计文档见 `docs/`：`PRD.md`、`APP_FLOW.md`、`TECH_STACK.md`、`FRONTEND_GUIDELINES.md`、`BACKEND_STRUCTURE.md`、`IMPLEMENTATION_PLAN.md`。

## License

[MIT](LICENSE)
