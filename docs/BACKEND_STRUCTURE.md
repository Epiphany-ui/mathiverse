# BACKEND_STRUCTURE — 后端架构文档

## 总体架构

```
浏览器 (Next.js 16 App Router)
  ├── 社区层: Server Components → mock-data.ts → (未来: Supabase)
  ├── AI 层:  ChatPanel → /api/chat (SSE) → DeepSeek API
  ├── 渲染层: CodeEditor → /api/render → localhost:9876 → Manim CLI
  └── 用户层: Supabase Auth Client → Supabase Auth Service
```

## 数据库 Schema（Drizzle ORM → PostgreSQL）

### 表关系

```
profiles (1) ──< visualizations (N)   author_id FK
profiles (1) ──< articles (N)         author_id FK
profiles (1) ──< comments (N)         author_id FK
visualizations (1) ──< comments (N)   target_type + target_id
articles (1) ──< comments (N)         target_type + target_id
profiles (1) ──< likes (N)            user_id FK (composite PK)
profiles (1) ──< bookmarks (N)        user_id FK (composite PK)
profiles (1) ──< follows (N)          follower_id / following_id FK (composite PK)
visualizations (1) ──< visualizations (N)  forked_from (self-ref)
```

### 8 张表

| 表 | 主键 | 关键字段 | 说明 |
|----|------|---------|------|
| `profiles` | `id` (UUID, FK→auth.users) | username, display_name, bio, avatar_url | 用户资料 |
| `visualizations` | `id` (UUID, gen) | title, source_code, video_url, tags[], author_id, forked_from, likes_count | 可视化作品 |
| `articles` | `id` (UUID, gen) | title, body_md, embedded_viz[], tags[], author_id | 文章 |
| `comments` | `id` (UUID, gen) | body, target_type, target_id, parent_id | 评论（支持嵌套） |
| `likes` | (user_id, target_type, target_id) | composite PK | 点赞关系 |
| `bookmarks` | (user_id, target_type, target_id) | composite PK | 收藏关系 |
| `follows` | (follower_id, following_id) | composite PK | 关注关系 |
| `tags` | `name` (TEXT) | usage_count | 标签使用统计 |

### CHECK 约束

```sql
-- comments
target_type IN ('visualization', 'article')

-- likes
target_type IN ('visualization', 'article', 'comment')

-- bookmarks
target_type IN ('visualization', 'article')
```

## RLS 安全策略

每个表启用 Row Level Security：

- **读**：已发布内容所有人可读（或全部可读，如 profiles/comments）
- **写**：仅认证用户可创建
- **改**：仅所有者可修改/删除
- **profiles**：注册时由触发器自动创建

### 注册触发器

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

用户在 Auth 注册后，自动在 `profiles` 表创建对应行。

## API 路由

### POST /api/chat
- 接收 `{ messages: [...] }`
- 构建 few-shot prompt → DeepSeek API SSE 流式
- 返回 `text/event-stream`（每 chunk 格式：`data: {"content": "..."}`）

### POST /api/render
- 接收 `{ code, quality, format }`
- 代理到 `localhost:9876/render`
- 返回 `{ success, video_url, duration, error }`

### GET /api/render
- 健康检查 `localhost:9876/health`
- 返回 `{ connected: bool }`

## DeepSeek AI 集成

### 客户端 (`src/lib/ai/client.ts`)
- 封装 OpenAI 兼容的 chat completions API
- 支持流式（stream: true）和非流式
- `isConfigured()` 检查 API Key 是否设置
- 错误时抛出中文错误信息

### Prompt 模板 (`src/lib/ai/prompts.ts`)
- **System Prompt**：定义 Manim 专家角色 + 规则（只用代码回答、优先使用哪些 Manim 对象等）
- **Few-shot Examples**：2 个高质量示例（傅里叶级数 + 欧拉公式）
- **extractCode()**：从 AI 返回中提取 Python 代码块

## 本地渲染器 (`renderer/server.py`)

### 端点
- `GET /health` → 检查 Manim 是否安装、返回版本
- `POST /render` → 接收代码 → 写入临时文件 → 调用 manim CLI → 返回视频 URL
- `GET /output/{file}` → 静态文件服务

### 渲染流程
```
收到 code → 提取 Scene 类名
  → 创建临时目录 → 写入 scene.py
  → subprocess: python -m manim scene.py SceneName -ql
  → 查找输出文件 → 复制到 OUTPUT_DIR
  → 清理临时目录 → 返回 video_url
```

### 错误处理
- Manim 未安装 → 提示安装命令
- 渲染超时（120s）→ 清理临时文件，返回超时错误
- 代码错误 → 提取 stderr 关键行返回
