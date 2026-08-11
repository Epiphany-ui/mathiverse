# Inline Animation Cards — Wiki 嵌入动画

**Created:** 2026-08-10
**Status:** design approved

## Problem

当前百科的"生成动画"功能打开一个全宽侧栏（MiniSandbox），包含聊天、代码编辑器、渲染按钮。问题是：
1. 动画工坊占满屏幕，和百科阅读体验割裂
2. 代码编辑器在最底部只有 260px，需要大量滚动
3. 无法在同一文章中多处生成动画并对比查看

## Solution

选中文字 → "生成动画" → 在选中文字下方**内联插入一张动画卡片**。卡片自带动画生成流水线（AI 代码生成 → 渲染 → 播放），成功后可直接在正文中观看，也可跳转沙箱深度编辑。

## Card Lifecycle & Progress

### 进度条阶段（细分 + 颜文字）

| 阶段 | 颜文字 | 标题 | 背后操作 | 估时 |
|------|--------|------|---------|------|
| 1 | (._.) | 正在理解概念... | 发送 chat API，模型内部推理分析数学概念 | 5-15s |
| 2 | (o_o) | 构思场景结构中... | 模型推理中——拆解数学对象、规划布局和时间线 | 5-15s |
| 3 | (>_<) | 正在写 Manim 代码... | 模型输出 Python 代码（streaming 可见） | 3-10s |
| 4 | (・_・) | 启动渲染引擎... | POST /api/render，Manim 开始渲染 | 2-5s |
| 5 | (⌐■_■) | 渲染动画中... | Manim 渲染 video，等待输出 | 5-20s |
| ✅ | (◕‿◕) | 完成啦！ | 视频就绪，自动播放 | — |
| ❌ | (╥﹏╥) | 生成失败 | 显示错误摘要 + 操作按钮 | — |

### Card States

```
┌─ [GENERATING] ──────────────────────────────────────┐
│ (o_o) 构思场景结构中...                              │
│ ████████████░░░░░░░░░░ 45%                          │
│ [取消]                                                │
└──────────────────────────────────────────────────────┘

┌─ [SUCCESS] ─────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────┐ │
│ │           [视频自动播放 loop muted]               │ │
│ └──────────────────────────────────────────────────┘ │
│ (◕‿◕) 完成啦！                                      │
│ [在沙箱中编辑]                        [⏸ 暂停]      │
└──────────────────────────────────────────────────────┘

┌─ [FAILED] ──────────────────────────────────────────┐
│ (╥﹏╥) 渲染失败                                      │
│ NameError: name 'np' is not defined                  │
│ [重试] [在沙箱中修复]                                 │
└──────────────────────────────────────────────────────┘
```

### Card Behavior

- **独立生命周期**：每个卡片独立的生成流水线，互不干扰
- **取消**：生成中可取消，卡片移除（可撤销？→ 不做，YAGNI）
- **自动播放**：成功后视频自动播放（muted, loop），不抢焦点
- **重试**：失败后可重试（重新走完整流水线）
- **沙箱跳转**：成功 → 带已有代码打开沙箱继续编辑；失败 → 带错误和代码打开沙箱修复

## Implementation

### Component Tree

```
WikiBody
├── MarkdownRenderer
├── TextSelectionTooltip          (existing, keep)
└── AnimationCardList             (new)
    └── AnimationCard × N         (new)
        ├── CardProgress          (generating state)
        ├── CardVideo             (success state)
        └── CardError             (failed state)
```

### Data Flow

```
TextSelectionTooltip.onAnimate({ text })
  → WikiBody.addCard({ text, position })
  → AnimationCardList renders new AnimationCard
  → AnimationCard fires generation pipeline:
     1. POST /api/chat { messages: [{role:"user", content: prompt}], currentCode: "" }
        → SSE stream → extractCode
     2. POST /api/render { code, quality: "-ql", format: "mp4" }
        → { video_url }
     3. On success: show video
     4. On failure: show error
  → Each stage updates card progress
```

### Files

| File | Change |
|------|--------|
| `src/components/wiki/animation-card.tsx` | **New** — 单个动画卡片组件（三态 + 进度条） |
| `src/components/wiki/animation-card-list.tsx` | **New** — 卡片列表容器 |
| `src/components/wiki/wiki-body.tsx` | Modify — 用 AnimationCardList 替换 MiniSandbox |
| `src/components/wiki/text-selection-tooltip.tsx` | Modify — 接口改为传递 position + 多卡片支持 |

### Sandbox Integration

卡片不是替代沙箱，而是**沙箱的入口**。点击"在沙箱中编辑" → 打开 MiniSandbox（保留现有组件），传入已有代码和对话历史。MiniSandbox 仍然存在，只是不再默认打开——它只在用户主动点击卡片上的按钮时才出现。

## Card Design Tokens

| Token | Value |
|-------|-------|
| 背景 | `bg-[#fdf8f5]/80` + `backdrop-blur-sm` |
| 边框 | `border border-[#e6dfd8]` |
| 圆角 | `rounded-xl` |
| 内边距 | `p-5` |
| 进度条颜色 | `bg-[#cc785c]` (brand coral) |
| 进度条背景 | `bg-[#e6dfd8]` |
| 错误文字 | `text-[#c64545]` |
| 成功文字 | `text-[#5db8a6]` |

和现有 `prose-custom` 纸质感完全一致。

## Non-Goals

- 不替换 MiniSandbox——保留作为深度编辑入口
- 不支持卡片间的对话共享——每个卡片独立
- 不做卡片持久化（刷新页面卡片消失）
- 不做撤消取消操作
