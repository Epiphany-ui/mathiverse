# FRONTEND_GUIDELINES — 前端开发规范

## 架构模式

### Server Components vs Client Components

```
Server Components (默认):
  - 所有 page.tsx（除非有交互）
  - 数据获取（mock-data queries）
  - MarkdownRenderer 包裹

Client Components ("use client"):
  - 有状态的 UI（表单、搜索框、按钮组）
  - 需要 hooks 的组件（useState, useEffect, useSearchParams）
  - 浏览器 API（clipboard, localStorage）
  - CodeMirror 编辑器
```

**规则**：默认写 Server Component，需要交互时才加 `"use client"`。

### 数据获取模式

当前使用 mock 数据（`src/lib/db/mock-data.ts`），所有 Supabase 代码有**优雅降级**：

```typescript
// 模式：检查配置后才创建客户端
const supabase = createClient();
if (!supabase) {
  // 返回 null 或错误提示
  return null;
}
```

切换到真实 Supabase 时，将 mock 函数替换为 Supabase 查询即可。

### State Management

- **服务端状态**：Server Components 直接调用查询函数
- **客户端状态**：useState + useCallback（不引入复杂状态库）
- **Auth 状态**：`useAuth` hook（Supabase onAuthStateChange 订阅）
- **Chat 状态**：`useChat` hook（SSE 流式管理）

## UI 设计规范

### 颜色使用

| Token | CSS Variable | 用途 |
|-------|-------------|------|
| `primary` | `--primary` | 主按钮、链接、活跃状态 |
| `secondary` | `--secondary` | 渐变搭配、辅色 |
| `accent` | `--accent` | 强调、高亮 |
| `muted-foreground` | `--muted-foreground` | 次要文本 |
| `border` | `--border` | 边框、分隔线 |
| `destructive` | `--destructive` | 错误、警告 |

### 卡片容器

```tsx
// 标准卡片
<GlassCard className="p-6" hover={true}>
  {/* 内容 */}
</GlassCard>

// 不可 hover 的静态卡片
<GlassCard hover={false}>...</GlassCard>
```

### 按钮渐变

```tsx
// 主 CTA
<Button className="bg-gradient-to-r from-primary to-secondary">

// 轮廓按钮
<Button variant="outline"> 或 <Button variant="ghost">
```

### 动画

- 页面过渡：不需要（服务端渲染）
- 交互反馈：Framer Motion（hover scale、tap bounce）
- 加载：Spinner（border-2 + animate-spin）
- 骨架屏：Skeleton 组件

## 代码规范

### 文件命名
- 组件：kebab-case 文件名，PascalCase 导出 `feed-card.tsx → FeedCard`
- 工具函数：camelCase `utils.ts → cn()`
- 类型文件：`types/index.ts`

### 导入顺序
```typescript
// 1. React / Next.js
import { useState } from "react";
import Link from "next/link";

// 2. 第三方
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

// 3. 内部组件
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";

// 4. 类型
import type { FeedItem } from "@/types";
```

### 中文处理

- UI 文本：直接写中文
- 注释：中文
- 变量/函数名：英文
- HTML lang：`zh-CN`
- 日期格式化：`zh-CN` locale

## 错误处理

- **Error Boundary**：`src/app/error.tsx` 捕获未处理错误
- **404**：`src/app/not-found.tsx` 自定义 404 页
- **API 错误**：返回 `{ error: string }` JSON，客户端展示 toast
- **Graceful Degradation**：Supabase 未配置时显示提示而非崩溃

## 响应式

- 桌面优先（1280px+）
- 平板适配（768px-1279px）：grid 减为 2 列
- 移动端（<768px）：grid 减为 1 列，Header 折叠
- ChatPanel 在移动端切换为全屏
