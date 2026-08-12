# PRD — Mathiverse 产品需求文档

## 产品定位

**Mathiverse** 是一个**以社区为先**的数学可视化学习平台。核心是将 AI（DeepSeek）+ Manim 渲染引擎整合，让用户用自然语言描述数学概念，一键生成专业级动画，并在社区中分享、讨论、Fork。

**一句话**：让数学动起来——像刷视频一样学数学，像 GitHub 一样协作开源。

## 目标用户

| 类型 | 描述 | 需求 |
|------|------|------|
| 数学爱好者 | 对数学概念好奇，想直观理解 | 浏览动画，看文章，简单互动 |
| 创作者 | 制作数学可视化内容 | AI 生成 Manim 代码，渲染发布 |
| 开发者 | 二次开发、Fork、贡献 | 开源源代码，Fork 链归属 |
| 教育者 | 教师、讲师 | 嵌入文章讲解数学概念 |
| 管理员 | 平台运维、内容审核 | 用户管理、内容管理、Wiki 审核看板 |

## 核心功能

### P0 — 已完成

1. **社区浏览**
   - 首页画廊（视频轮播 + 轨道动画 Fallback + 展览索引 Bar + 数学领域地图）
   - Feed 流（热门/最新/关注排序）
   - 可视化详情页（视频 + 源码 + 评论 + 作者头像）
   - 文章详情页（Markdown + KaTeX + 评论 + 作者头像）
   - 发现页（标签筛选）
   - 搜索（关键词搜索）
   - 用户主页（作品/文章/收藏/Fork Tab）

2. **社交互动**
   - 点赞（可视化 + 文章 + 评论 + Wiki）
   - 收藏/书签
   - Fork（复制源码到沙箱，保留溯源链）
   - 嵌套评论
   - 关注/粉丝
   - 通知系统（点赞/评论/关注/Fork 触发器 + 下拉面板）

3. **AI 沙箱**
   - CodeMirror 6 Python 编辑器（typewriter 动画）
   - DeepSeek SSE 流式对话
   - 自然语言 → Manim 代码生成
   - 代码编辑、AI 修复、手动渲染
   - 发布到社区

4. **用户系统**
   - 邮箱注册/登录（Supabase Auth）
   - 个人资料设置（含头像上传、密码修改）
   - 登录态感知 Header

5. **本地渲染器**
   - Python FastAPI 服务（localhost:9876）
   - Manim CLI 渲染 → 返回视频/动图
   - 视频代理 API

6. **数学百科（Wiki）**
   - 数学词条库（纯数学 / 应用数学 / CS 交叉 三个领域）
   - KaTeX 数学公式渲染
   - 知识图谱可视化（SVG 径向图 + 标签回退）
   - 选中文本即时生成 Manim 动画卡片
   - 行内动画卡片（5 阶段进度 + 迷你沙箱）
   - RAG 代码增强（Ollama bge-m3 向量检索 + DeepSeek 生成）

### P0 — 已实现 ✅

7. **AI 生成工作室**（✅ 已实现）
   - 质量优先自动流水线：规划→检索→生成→验证→渲染→修复
   - 结构化 SSE 事件流（11 种事件类型）
   - 自动修复上限 2 次，手动接管保留
   - 渲染缓存（按代码+环境+质量建 key）
   - 沉浸式暗场工作室 UI（5 个视口适配）
   - 入口动画（700-900ms，prefers-reduced-motion 降级）
   - 状态机 + Job Store + 类型化渲染器客户端已完成（22 文件，53 测试）

8. **管理员系统**（✅ 已实现）
   - `profiles.role` 字段（user/admin）
   - `wiki_entries.author_id` 字段 + 贡献者 UI
   - 管理员后台 `/admin`（数据看板、用户管理、内容管理、Wiki 审核）
   - 审计日志（admin_audit_log）
   - 管理员 API 路由（需 role 鉴权）

### P1 — 后续迭代

- GitHub OAuth 登录
- 推荐系统（协同过滤）
- 组织/团队
- 视频流播放优化 + Supabase Storage 存储化发布
- 国际化（i18n）
- Wiki 管理员审核上线后的真实工作流（审批/驳回/反馈）
- 公开部署（Vercel）

### P2 — 远期

- 移动端专项优化与验证
- E2E 测试（Playwright，5 个视口）
- 邀请制注册
- 细粒度 RBAC（角色：user / moderator / admin）
- 内容举报/申诉
- 可视化嵌入文章编辑器 UI
- 多人实时协作沙箱

## 明确不做（MVP/P1 阶段）

- License 管理
- 训练或微调新的基础模型
- 公开模型原始思维链（reasoning_content）
- 通用分布式任务平台
- diff 优先修复（当前用完整代码修复）
- 管理员操作撤销/回滚（审计日志仅记录）

## 内容模型

- **Visualization Unit（可视化单元）**：独立的 Manim 作品，含标题、描述、标签、源码、渲染视频、Fork 源。可 Fork。
- **Article（文章）**：Markdown 正文 + 可嵌入可视化。不可 Fork。
- **Wiki Entry（百科词条）**：结构化数学知识，含 Markdown 正文、KaTeX 公式、关联边、贡献者归属。

## 技术栈

见 `docs/TECH_STACK.md`。

## 设计系统

- 品牌色：Gallery Black `#0B0F0C`、Archive Paper `#F2F3ED`、Function Blue `#4169FF`、Orbit Green `#25BEA5`、Calculus Orange `#FF603B`
- 字体：Noto Sans SC（中文 UI）、JetBrains Mono（代码/元数据）、Inter（英文/数字）、Cormorant Garamond（标题装饰）
- 设计参考：`design-refs/claude.md`（主参考 Anthropic 暖奶油编辑风格），其他参考见 `CLAUDE.md`
- 主题：通过 next-themes 支持 light/dark toggle
- 组件：shadcn/ui (base-ui + Tailwind)，CSS Modules 用于自定义布局

## 非功能性需求

- TypeScript 零错误、ESLint 零错误
- 全部单元测试通过（Node test runner + tsx）
- Next.js 生产构建成功
- 响应式（桌面为主，CSS 适配平板/手机）
- 中文优先（lang="zh-CN"）
- prefers-reduced-motion 支持
- 可访问性（语义化 HTML、ARIA label、键盘操作、焦点管理）
