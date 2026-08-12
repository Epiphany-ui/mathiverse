# 沙箱入场动效 PRD — 数学场域展开

## 一句话

沙箱首次进入时播放「数学场域展开」四阶段入场动效——坐标系原点→网格展开→面板浮现→微光收束。

## 产品目标

- 用数学视觉语言（坐标、网格、曲线）替代通用淡入/位移动效
- 建立 Mathiverse "数学画廊"品牌辨识度
- 不遮挡交互——用户随时可输入
- 恢复任务仅 180ms 柔和聚焦，视觉区分"新会话"和"回到任务"

## 动效设计

| 阶段 | 时间 | 视觉 | 实现方式 |
|------|------|------|----------|
| 原点 | 0–180ms | 深色背景中出现微弱坐标原点 + 十字准星 | `.canvasStage::before` 伪元素 |
| 展开 | 180–500ms | 细铜色 (#cc785c) 坐标线向四周展开，函数曲线快速绘制 | `.canvasStage::after` SVG/渐变 + border 动画 |
| 定型 | 300–720ms | 画布定型，taskRail、codePanel 依次从边缘滑入 | transform + opacity on `[data-studio-motion-layer]` |
| 收束 | 720–900ms | 曲线化成画布边框微光脉冲，界面完全稳定 | canvasStage border-color transition |

## 三状态行为

| Entrance | 触发条件 | 动效 | 时长 |
|----------|----------|------|------|
| `first` | 浏览器会话首次进入，无 jobId | 完整四阶段 | 900ms |
| `resume` | 有 jobId（恢复任务） | 柔和聚焦（opacity +轻微 scale） | 180ms |
| `settled` | 已播过动效，无 jobId | 无动效 | 0ms |

## 可访问性

| 场景 | 行为 |
|------|------|
| `prefers-reduced-motion: reduce` | 所有状态仅 120ms 淡入 |
| 移动端（≤767px） | 完整动效压缩至 650ms |

## 不做

- 不放大 Logo
- 不显示加载百分比/进度条
- 不动 JS（纯 CSS `@keyframes` + `animation-delay`）
- 不改 entrance 判断逻辑（`resolveStudioEntrance` 不变）
- 不引入动画库（framer-motion 等）

## 颜色 Token

| Token | 用途 |
|-------|------|
| `#cc785c` (coral) | 坐标线、曲线描边 |
| `#79d8c7` (teal accent) | 十字准星中心点 |
| `var(--studio-line)` | 网格参考线 |
| `var(--studio-ink)` | 背景 |
