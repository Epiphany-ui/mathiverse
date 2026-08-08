# IMPLEMENTATION_PLAN — 实施计划

## 总览

| Phase | 名称 | 状态 | 耗时 | 产出 |
|-------|------|------|------|------|
| 0 | 项目脚手架 | ✅ | 1 天 | Next.js + pnpm + shadcn/ui + Drizzle |
| 1 | 设计系统 + 基础组件 | ✅ | 2 天 | CSS 变量、20 个组件、粒子背景、玻璃态 |
| 2 | 用户系统 | ✅ | 1 天 | Supabase Auth、登录/注册、优雅降级 |
| 3 | 社区核心 | ✅ | 3 天 | Feed、详情页、评论、点赞、搜索、发现 |
| 4 | AI 沙箱 IDE | ✅ | 3 天 | DeepSeek API、SSE、CodeMirror 6、ChatPanel |
| 5 | 本地渲染器 | ✅ | 2 天 | Python FastAPI、Manim CLI、Tauri 脚手架 |
| 6-7 | 联调 + 视觉打磨 | ✅ | 2 天 | 错误边界、404、Loading、响应式、视觉微调 |
| **总计** | | | **~14 天** | |

## 项目文件清单

```
mathiverse/
├── docs/                           # 项目文档
│   ├── PRD.md
│   ├── APP_FLOW.md
│   ├── TECH_STACK.md
│   ├── FRONTEND_GUIDELINES.md
│   ├── BACKEND_STRUCTURE.md
│   └── IMPLEMENTATION_PLAN.md (本文件)
├── src/
│   ├── app/                        # 14 条路由
│   │   ├── page.tsx                # 首页
│   │   ├── layout.tsx              # 根布局
│   │   ├── globals.css             # 全局样式
│   │   ├── error.tsx               # 错误边界
│   │   ├── not-found.tsx           # 404
│   │   ├── loading.tsx             # 全局加载
│   │   ├── explore/                # 发现
│   │   ├── search/                 # 搜索
│   │   ├── sandbox/                # AI 沙箱
│   │   ├── settings/               # 设置
│   │   ├── auth/                   # 登录/注册/回调
│   │   ├── v/[id]/                 # 可视化详情
│   │   ├── a/[id]/                 # 文章详情
│   │   ├── u/[username]/           # 用户主页
│   │   └── api/chat/, api/render/  # API 路由
│   ├── components/
│   │   ├── ui/ (17)                # shadcn/ui
│   │   ├── layout/                 # AppHeader
│   │   ├── community/              # FeedCard, FeedGrid, CommentList
│   │   ├── sandbox/                # CodeEditor, ChatPanel
│   │   ├── content/                # Markdown, Video, Code, Tags
│   │   └── shared/                 # Particles, Glass, Like, Fork, Bookmark
│   ├── lib/
│   │   ├── ai/                     # DeepSeek client + prompts
│   │   ├── db/                     # Schema + mock data
│   │   └── supabase/               # Client, server, middleware
│   ├── hooks/                      # useAuth, useChat
│   └── types/                      # 完整 TS 类型
├── renderer/                       # Python 渲染器
│   ├── server.py
│   ├── requirements.txt
│   ├── start.bat / start.sh
│   └── README.md
├── src-tauri/                      # Tauri 2.x 包装
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   └── src/main.rs, lib.rs
├── supabase-migration.sql          # 数据库迁移
├── .env.local                      # 环境变量（不提交）
├── .gitignore
└── package.json
```

## 待完成项

### 高优先级
- [ ] 执行 `supabase-migration.sql` 到 Supabase 项目
- [ ] 将 mock-data 查询替换为 Supabase 真实查询
- [ ] 可视化/文章创建页面
- [ ] 发布流程（沙箱 → 填写信息 → 发布）
- [ ] 渲染完成后自动刷新预览

### 中优先级
- [ ] 安装 Rust + 构建 Tauri 系统托盘
- [ ] 协同过滤推荐系统
- [ ] 通知系统（点赞/评论/关注）
- [ ] GitHub OAuth 登录
- [ ] 视频上传到 Supabase Storage

### 低优先级
- [ ] 移动端适配优化
- [ ] 性能优化（图片懒加载、Suspense 边界优化）
- [ ] E2E 测试（Playwright）
- [ ] 国际化
- [ ] 公网部署

## 启动指南

```bash
# 1. 前端
pnpm dev                    # http://localhost:3000

# 2. 渲染器（新终端，需要 Python 3.10+）
cd renderer && start.bat    # http://localhost:9876

# 3. 配置
# .env.local 中设置 Supabase URL/Key + DeepSeek API Key

# 4. 数据库（首次）
# Supabase SQL Editor 执行 supabase-migration.sql

# 5. Tauri（可选，需要 Rust）
pnpm tauri dev
```

## 已知问题与解决方案

| 问题 | 状态 | 方案 |
|------|------|------|
| `Response.json()` 不可用（TS 5.0） | ✅ 已修 | 使用 `NextResponse.json()` |
| `<a>` 嵌套 `<a>`（TagBadge + Link） | ✅ 已修 | 移除外层 Link，TagBadge 自带 Link |
| `<button>` 嵌套 `<button>`（CodeViewer） | ✅ 已修 | 外层改为 div[role=button] |
| `useSearchParams` 需 Suspense | ✅ 已修 | Explore/Search 拆分为 page.tsx + content.tsx |
| `HighlightStyle` 不在 @lezer/highlight | ✅ 已修 | 改为从 @codemirror/language 导入 |
| DeepSeek 分类器不可用 | ⚠️ 偶发 | 重试或 sandbox 禁用 |
| Git 中文路径乱码 | ⚠️ | `HOME=/c/Users/Public` 临时绕过 |
