# 入场动效实施计划 — 数学场域展开

## 概述

仅改 CSS。在 `sandbox-studio.module.css` 中新增 `@keyframes` 和属性选择器，利用已有的 `data-studio-entrance` 和 `data-studio-motion-layer` 属性驱动动画。

## 改动文件

**只改一个文件：** `src/components/sandbox/sandbox-studio.module.css`

## CSS 架构

### 属性选择器入口

```css
/* 首次进入 — 完整四阶段 */
.studio-entrance-shell[data-studio-entrance="first"] .canvasStage { ... }
.studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="task"] { ... }
.studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="code"] { ... }

/* 恢复任务 — 180ms 柔和聚焦 */
.studio-entrance-shell[data-studio-entrance="resume"] [data-studio-motion-layer="shell"] { ... }

/* 无动效 — instant */
.studio-entrance-shell[data-studio-entrance="settled"] { ... }
```

### 阶段 1: 原点与十字准星 (0–180ms)

在 `.canvasStage` 上用 `::before` 伪元素画十字准星：

```css
@keyframes origin-appear {
  0%   { opacity: 0; transform: scale(0.4); }
  60%  { opacity: 0.7; }
  100% { opacity: 0.35; transform: scale(1); }
}

.studio-entrance-shell[data-studio-entrance="first"] .canvasStage::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  /* 十字准星：水平 + 垂直线交汇于中心 */
  background:
    linear-gradient(90deg, transparent 49.8%, #cc785c44 49.8%, #cc785c44 50.2%, transparent 50.2%),
    linear-gradient(0deg,  transparent 49.8%, #cc785c44 49.8%, #cc785c44 50.2%, transparent 50.2%);
  animation: origin-appear 180ms ease-out both;
  animation-delay: 0ms;
}
```

### 阶段 2: 坐标线展开 + 曲线绘制 (180–500ms)

```css
@keyframes grid-expand {
  0%   { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes curve-draw {
  0%   { stroke-dashoffset: 1; }
  100% { stroke-dashoffset: 0; }
}

/* 网格线扩展 */
.studio-entrance-shell[data-studio-entrance="first"] .canvasStage {
  animation: grid-expand 320ms ease-out 180ms both;
}

/* 函数曲线 — 叠加在 canvasStage 的 after 伪元素上 */
.studio-entrance-shell[data-studio-entrance="first"] .canvasStage::after {
  animation: curve-pulse 320ms ease-out 180ms both,
             border-glow 180ms ease-out 720ms both;
}
```

### 阶段 3: 面板浮现 (300–720ms)

task 和 code 面板依次从边缘滑入：

```css
@keyframes panel-enter-left {
  0%   { opacity: 0; transform: translateX(-24px); }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes panel-enter-right {
  0%   { opacity: 0; transform: translateX(24px); }
  100% { opacity: 1; transform: translateX(0); }
}

.studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="task"] {
  animation: panel-enter-left 420ms ease-out 300ms both;
}

.studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="code"] {
  animation: panel-enter-right 420ms ease-out 420ms both;
}
```

### 阶段 4: 微光脉冲收束 (720–900ms)

```css
@keyframes border-glow {
  0%   { border-color: #cc785c88; box-shadow: 0 0 12px #cc785c33; }
  100% { border-color: var(--studio-line); box-shadow: none; }
}

.studio-entrance-shell[data-studio-entrance="first"] .canvasStage {
  animation: grid-expand 320ms ease-out 180ms both;
  /* 阶段 4 叠加在 border 上 */
}
```

### 恢复任务 (resume, 180ms)

```css
@keyframes soft-focus {
  0%   { opacity: 0.6; filter: blur(2px); }
  100% { opacity: 1; filter: blur(0); }
}

.studio-entrance-shell[data-studio-entrance="resume"] .studio {
  animation: soft-focus 180ms ease-out both;
}
```

### 移动端缩短

```css
@media (max-width: 767px) {
  .studio-entrance-shell[data-studio-entrance="first"] .canvasStage::before {
    animation-duration: 120ms;
  }
  .studio-entrance-shell[data-studio-entrance="first"] .canvasStage {
    animation-duration: 220ms;
    animation-delay: 120ms;
  }
  .studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="task"] {
    animation-duration: 280ms;
    animation-delay: 200ms;
  }
  .studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer="code"] {
    animation-duration: 280ms;
    animation-delay: 300ms;
  }
}
```

### reduced-motion (120ms 淡入)

```css
@media (prefers-reduced-motion: reduce) {
  @keyframes simple-fade {
    0%   { opacity: 0; }
    100% { opacity: 1; }
  }

  .studio-entrance-shell[data-studio-entrance="first"] .canvasStage::before,
  .studio-entrance-shell[data-studio-entrance="first"] .canvasStage::after {
    animation: none;
  }

  .studio-entrance-shell[data-studio-entrance="first"] .studio,
  .studio-entrance-shell[data-studio-entrance="resume"] .studio {
    animation: simple-fade 120ms ease-out both;
  }

  .studio-entrance-shell[data-studio-entrance="first"] [data-studio-motion-layer] {
    animation: simple-fade 120ms ease-out both;
  }
}
```

## 实施步骤

1. 在 `sandbox-studio.module.css` 末尾追加所有 `@keyframes` 定义
2. 追加 `[data-studio-entrance]` 属性选择器规则
3. 追加 `@media` 查询（移动端 + reduced-motion）
4. `pnpm build` 验证编译
5. 浏览器中测试三种 entrance 状态

## 验证清单

- [ ] 首次进入沙箱：四阶段完整播放，900ms
- [ ] 恢复任务：180ms 柔和聚焦
- [ ] 二次进入（无任务）：无动效，即时显示
- [ ] 全程可点击输入（不遮挡）
- [ ] `prefers-reduced-motion` 下仅 120ms 淡入
- [ ] 移动端布局下约 650ms
- [ ] 不出现 layout shift 或闪烁
