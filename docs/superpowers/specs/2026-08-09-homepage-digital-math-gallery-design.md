# Mathiverse 首页「数字数学画廊」重构设计

## 状态

- 日期：2026-08-09
- 状态：已经用户确认
- 范围：首页视觉、首页交互、首页到 Sandbox 的提示词预填

## 目标

将 Mathiverse 首页从通用的「暖色 SaaS 落地页 + 等宽卡片网格」重构为「数字数学画廊」。用户应在首屏两秒内理解 Mathiverse 的核心主张：数学会运动，而且用户可以亲自创造它。

重构不只美化组件，而是重新分配数学内容与 UI 的视觉权重：数学影像、轨迹、曲线、参数与注释是主体，导航、标题、元数据和操作退到画面边缘。

## 非目标

- 不修改 Supabase 表结构、认证、通知、发布或详情页业务逻辑。
- 不同步重构 Explore、Sandbox、详情页和设置页的视觉系统。
- 不删除其他页面仍在使用的全局动画类。
- 不引入 Canvas 粒子、重型动画库或与核心体验无关的新依赖。
- CTA 不自动发送 AI 请求，只预填用户输入。

## 已确认的核心决策

1. 视觉基础方向为 B「数字数学画廊」。
2. 主展品采用混合媒体：真实社区视频优先，内建 SVG 数学动画回退。
3. 页面采用「暗色展厅首屏 + 浅色编辑内容区」。
4. 首屏保留品牌标题、一行产品解释和一个主创作入口，不做纯艺术展示，也不堆叠技术卖点。
5. 首页底部概念输入会跳转到 `/sandbox?prompt=...`，并将内容预填到 ChatPanel，不自动发送。
6. 中文字体采用 Noto Sans SC，只使用 400 和 500 字重。

## 页面叙事

### 1. 暗色主展厅

首屏高度约为可视区的 85%--95%。展品占据画面主体，导航和文字信息与影像重叠而不另起容器。

展示内容：

- 展览编号与数学领域标签。
- 主展品标题、简短说明和作者信息。
- 「开始创作」主入口与「浏览作品」次入口。
- 静音、循环、`playsInline` 的社区视频，或内建轨道 SVG。
- 一个有明确可见名称的播放/暂停控制。

### 2. 展览索引

通过横向细则与文字序列展示「当前展品」、「下一件作品」和「社区笔记」。该区域不使用卡片、背景色块或独立阴影。

### 3. 浅色数学领域导航

从 Gallery Black 过渡到 Archive Paper。Geometry、Calculus、Algebra、Probability 等节点使用细线建立空间关系。hover 与键盘 focus 显示对应的构造线、切线、变换或分布图。

每个节点链接到现有 `/explore?tag=...` 筛选能力；标签必须使用当前数据中可识别的中文 tag，不新增后端分类。

### 4. Editorial Community

使用严格的十二列网格，但不让内容等宽或等高。排序继续沿用现有 hot feed，版位根据内容类型与顺序确定，不随机重排：

- 第一件可视化作为大幅横向作品。
- 后续可视化分配为窄幅竖向作品或小型实验。
- 第一篇文章作为纯排版内容，不强制生成封面卡片。
- 数据不足时减少版位，不复制内容或伪造统计。
- 无数据时只保留品牌展品、领域导航和创作入口。

### 5. 概念创作入口

使用「你想看到什么？」作为问句，并提供一个可编辑的数学概念输入。

提交行为：

1. 去除首尾空白。
2. 空内容不跳转，在原位显示明确提示。
3. 非空内容使用 `encodeURIComponent` 生成 `/sandbox?prompt=...`。
4. Sandbox 从查询参数只读取一次初始值，填入 ChatPanel 文本框。
5. 用户仍需手动点击「发送」。

## 视觉系统

### 颜色

| 名称 | 色值 | 语义 |
| --- | --- | --- |
| Gallery Black | `#0B0F0C` | 首屏与影像舞台 |
| Archive Paper | `#F2F3ED` | 浅色阅读区 |
| Mathematical Ink | `#121510` | 正文、结构线、主要前景 |
| Function Blue | `#4169FF` | 代数、函数、主交互 |
| Orbit Green | `#25BEA5` | 几何、轨迹、动态标记 |
| Calculus Orange | `#FF603B` | 导数、切线、关键参数 |

大面积只使用 Gallery Black、Archive Paper 和 Mathematical Ink。彩色必须属于数学对象、数学领域或交互状态，不作为随机装饰背景。

### 字体与排版

- 中文标题和正文：Noto Sans SC 400/500。
- 英文正文：现有 Inter 400/500。
- 展览编号、坐标、参数和公式注释：现有 JetBrains Mono。
- 不在首页使用 Cormorant Garamond 作为中文标题的风格来源。
- 标题尺寸、留白、细则和对齐建立层级，容器背景和圆角不承担主要层级。

实现 Noto Sans SC 前必须阅读本项目 `node_modules/next/dist/docs/` 中 Next.js 16.3 的字体指南，并使用当前版本支持的 API。字体应由 Next.js 托管并使用 swap 策略，不从运行时 CSS CDN 加载。

## Mathiverse 视觉原语

首页引入七个有语义的原语，但实现只服务本次首页，不同步改造全站：

- Point：离散状态或参数位置。
- Line：结构连接、时间轴或展览索引。
- Axis：度量与坐标。
- Orbit：主展品的签名轨迹。
- Vector：方向和主操作提示。
- Function：可视化的数学曲线。
- Annotation：编号、参数、方程和领域标签。

## 运动语言

- 页面首次进入只编排一次标题、轨迹与主展品揭示。
- SVG 轨道运动必须缓慢、连续、可预测，不使用 spring 或 bounce。
- 展览索引与社区内容不重复使用通用 scroll reveal。
- 领域节点的 hover/focus 反馈来自数学构造变化，不来自 `translateY` 或倾斜。
- `prefers-reduced-motion: reduce` 时显示静态关键帧，不自动播放视频，不循环 SVG 运动。

## 组件边界

### 保留

- `src/lib/db/queries.ts` 的现有 feed 查询与排序行为。
- `AppHeader` 的认证、搜索、通知、移动导航与退出逻辑。
- 可视化、文章、用户、Explore 和 Sandbox 路由。
- `GenerativeThumbnail` 作为次级内容的静态回退，但不把它放大为首屏主展品。

### 重构

- `src/app/page.tsx`：仅负责服务端数据获取、选择派生数据和组合首页区块。
- `AppHeader`：新增可选的 gallery 外观，仅首页使用。在暗色首屏上透明显示，进入浅色内容后恢复可读的纸色表面。默认外观不变，避免影响其他路由。
- Sandbox 与 `ChatPanel`：接受一次性 `initialPrompt`，仅设定 textarea 初始值。

### 新增首页专用单元

建议放在 `src/components/home/`：

- `gallery-hero.tsx`：主展品、标题、媒体状态和播放/暂停。
- `mathematical-fallback.tsx`：内建 SVG 轨道动画与 reduced-motion 静态帧。
- `exhibition-index.tsx`：当前作品、下一件作品和社区笔记。
- `math-field-map.tsx`：数学领域节点、辅助图形和 Explore tag 链接。
- `editorial-feed.tsx`：首页专用的不等宽内容编排。现有 `FeedGrid` 保留给 Explore/Search 等页面。
- `concept-prompt.tsx`：输入验证与 Sandbox URL 生成。
- `home-data.ts`：纯函数，负责主展品选择、版位分配、领域 tag 归纳和 Sandbox URL 生成。

## 数据流

1. Home Server Component 调用现有 `buildFeedItems(client, "hot")`。
2. `FeedItem` 补充现有数据表已提供的 `videoUrl?: string | null`；不做 schema migration。
3. `selectGalleryFeature` 优先返回第一条带 `videoUrl` 的可视化；否则返回第一条可视化；再否则返回 `null`。
4. `GalleryHero` 收到 feature 后，客户端只管理 `loading` / `video` / `fallback` / `paused` 四种媒体状态。
5. `buildEditorialSlots` 对剩余内容做确定性分配，不修改原数组，不随机化。
6. `buildFieldLinks` 从 tags 中生成最多六个领域入口，不伪造作品数量。

## 异常、性能与可访问性

### 异常状态

- video `error`、超时或不允许自动播放时进入 SVG fallback，不显示技术错误框。
- 媒体容器应有稳定尺寸，切换时不产生首屏布局跳动。
- Supabase 未配置、feed 为空或查询失败时，主展品使用内建 SVG，并保留创作入口。
- CTA 空输入错误应指明用户需要输入一个数学概念。

### 性能

- 首屏只有一个持续运动媒体。
- 不创建 Canvas 粒子场，不运行每帧大量 React 状态更新。
- SVG 运动优先使用 CSS transform 和 stroke 属性。
- video 默认 `preload="metadata"`；非首屏视频不自动播放。
- 使用固定 aspect ratio 或明确 min-height 控制累积布局偏移。

### 可访问性

- 所有可点击领域节点使用真实链接或按钮，不使用无语义 div。
- hover 反馈同样必须在键盘 focus 时出现。
- 图标按钮必须有可读名称，焦点样式不被动画覆盖。
- 展品视频需有可见的播放/暂停控制。
- SVG 提供简洁的 `title` / `desc`，装饰线标记为不可读。
- 颜色不作为唯一领域编码，同时使用文本标签和图形差异。

## 响应式构图

### Desktop

- 首屏为大幅横向展厅，文本放在左下或画面边缘。
- 展览索引使用三段横向序列。
- 社区内容使用十二列不对称网格。

### Tablet

- 主展品仍保持横向，文本尺度收窄，不另外生成大卡片。
- 展览索引允许两列换行。
- Editorial Feed 改为主作品 + 双列次级内容。

### Mobile

- 主展品 edge-to-edge，标题和控制放在画面底部的可读安全区。
- 展览索引改为紧凑纵向目录，不强制保留三列。
- 数学领域导航保留主要节点，减少辅助线与动画复杂度。
- 社区内容按「大作品 → 纯文字内容 → 小作品」重排，不等价为所有卡片单列堆叠。

## 测试与验证

### 测试优先

在写生产实现前，为以下纯函数建立失败测试：

- 主展品选择：视频可视化优先，无视频回退，空数组返回 `null`。
- Editorial 版位：不复制、不丢失、顺序确定，能处理 0--4 条内容。
- 领域链接：tag 正确编码，数量上限为六。
- Sandbox URL：去除空白、拒绝空输入、正确编码中文与数学符号。

优先使用当前 Node 运行时的内置测试能力。如果 Next.js 16.3 工具链与内置 TypeScript 执行方式不兼容，实施计划必须明确说明最小测试运行器选择，不在实现中临时引入大型测试栈。

### 静态与构建验证

- ESLint。
- TypeScript 无输出检查。
- Next.js production build。
- 不得新增 hydration、无效 DOM nesting、媒体或字体加载警告。

### 视觉与交互验证

- Desktop、Tablet、Mobile 三种构图。
- 暗色首屏与浅色内容交界处的 Header 可读性。
- 有视频、无视频、视频失败和 reduced-motion 四种主展品状态。
- 键盘访问数学领域节点、媒体控制与 CTA。
- CTA 将中文数学提示词预填到 Sandbox，且不自动发送。

## 验收标准

1. 首屏第一视觉主体是数学影像或数学轨道，不是标题卡片或渐变光球。
2. 两秒内能理解「Mathematics in Motion」与「可以自己创作」。
3. 不在首页使用 TiltCard、统一三列 FeedGrid、Hero gradient blobs 或通用 fly-in/bounce 编排。
4. 主展品在真实视频不可用时稳定显示 SVG fallback，不出现空白首屏。
5. 暗色展厅与浅色社区区域有明确转场，但不依赖装饰性渐变。
6. Editorial Feed 展示明显不同的内容权重，且小数据集下不复制内容。
7. Noto Sans SC 是中文主字体，首页只请求需要的字重。
8. 首页 CTA 会真实预填 Sandbox，但不会代替用户发送。
9. 动画尊重 `prefers-reduced-motion`，媒体提供可操作的暂停方式。
10. 现有路由、认证、通知、数据查询、发布和详情页行为不受破坏。

## 对原 prompt 的执行修正

- 「建立 Mathiverse 全站原语」在本轮收窄为首页专用原语，避免在一次首页任务中无边界重构全站。
- 「自动播放真实作品」增加无视频、播放失败、用户暂停和 reduced-motion 回退。
- 「底部概念输入」实现为真实 Sandbox 预填，而不是静态视觉道具。
- 「短方案后直接改代码」替换为先定稿设计、再编写实施计划和测试，降低大幅视觉改动破坏现有功能的风险。
