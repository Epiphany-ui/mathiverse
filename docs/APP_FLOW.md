# APP_FLOW — 应用流程与路由

## 路由总览

| 路由 | 类型 | 说明 |
|------|------|------|
| `/` | Static | 首页：Hero + Feed 流 |
| `/explore` | Static | 发现页：排序 + 标签筛选 + 内容网格 |
| `/search` | Static | 搜索页：关键词搜索 + 建议标签 |
| `/sandbox` | Static | AI 沙箱 IDE |
| `/settings` | Static | 个人设置 |
| `/auth/login` | Static | 登录页 |
| `/auth/register` | Static | 注册页 |
| `/auth/callback` | Dynamic | Supabase Auth 回调 |
| `/v/[id]` | Dynamic | 可视化详情 |
| `/a/[id]` | Dynamic | 文章详情 |
| `/u/[username]` | Dynamic | 用户主页 |
| `/api/chat` | Dynamic | SSE 流式 AI 对话 API |
| `/api/render` | Dynamic | 渲染器代理 API |
| `/_not-found` | Static | 404 页面 |

## 核心用户流程

### 1. 浏览内容
```
首页 → 浏览 Feed → 点击卡片 → 可视化/文章详情
                   → 点赞/收藏/评论
                   → Fork（可视化）→ 跳转沙箱
     → 点击"发现" → 发现页 → 标签筛选 → 浏览内容
     → 搜索关键词 → 搜索结果 → 浏览内容
```

### 2. 注册/登录
```
点击"登录" → /auth/login → 邮箱密码 → Supabase Auth
    或"注册" → /auth/register → 填写信息 → 创建账户
                → 触发器自动创建 profile
                → 跳转首页
已登录 → Header 显示头像 → 下拉菜单（主页/设置/退出）
```

### 3. AI 创作
```
/sandbox → 左侧 ChatPanel 输入描述 → Enter 发送
   → POST /api/chat (SSE) → DeepSeek API → 流式返回
   → 提取 Python 代码 → 右侧 CodeMirror 编辑器
   → 用户编辑代码（或继续对话修改）
   → 点击"渲染" → POST /api/render → Python FastAPI
   → Manim CLI 渲染 → 返回视频 URL
   → 点击"发布" → 创建可视化单元
```

### 4. 发布可视化
```
沙箱渲染完成后 → 点击"发布" → 填写标题/描述/标签
   → 服务器保存到 Supabase visualizations 表
   → 跳转到 /v/[id] 详情页
   → 出现在社区 Feed
```

### 5. 写文章
```
（暂未实现单独创建页，后续添加）
创建文章 → Markdown 编辑器 → 可嵌入已有的可视化
   → 发布到 articles 表 → /a/[id]
```

## 组件树

```
RootLayout (layout.tsx)
├── ParticlesBackground (全局粒子背景)
├── AppHeader
│   ├── Logo + Nav Links (发现/创作)
│   ├── Search (可展开)
│   └── Auth (登录/注册 OR 头像下拉菜单)
└── Main Content (per-page)

Details Page Pattern:
├── ParticlesBackground
├── AppHeader
├── Main
│   ├── Back Button
│   ├── Content (Video/Markdown + Info)
│   ├── Tags
│   ├── Source Code (可视化)
│   ├── Embedded Visualizations (文章)
│   ├── Separator
│   └── CommentList (树形嵌套)
└── Footer

Sandbox Page Pattern:
├── ParticlesBackground
├── AppHeader
├── Main (flex row)
│   ├── ChatPanel (380px)
│   │   ├── Header
│   │   ├── Messages (ChatBubble)
│   │   └── Input Area
│   └── Right Panel
│       ├── Toolbar (scene.py + Render + Publish buttons)
│       └── CodeEditor (CodeMirror 6 Python)
```

## 数据流

```
Supabase Auth → getSession() → onAuthStateChange()
  → AppHeader 显示登录态
  → 受保护的操作（点赞/评论/发布）需要登录

社区数据:
  当前: mock-data.ts (dev) → 组件直接调用
  未来: Supabase queries → Server Components / Server Actions → RLS 策略

AI 对话:
  ChatPanel → useChat hook → fetch /api/chat (SSE)
    → DeepSeek API → 流式返回 → 实时更新聊天消息
    → 提取代码 → CodeEditor

渲染:
  CodeEditor → fetch /api/render → Python FastAPI
    → manim CLI → 返回视频 URL
```
