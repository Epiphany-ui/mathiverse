import type {
  Profile,
  Visualization,
  Article,
  Comment,
  FeedItem,
  FeedSort,
} from "@/types";

/* ─── Profiles ─── */
export const mockProfiles: Profile[] = [
  {
    id: "u1",
    username: "mathwizard",
    displayName: "数学巫师",
    avatarUrl: null,
    bio: "数学PhD在读，热爱可视化一切数学概念。用动画让抽象变得直观。",
    website: "https://mathwizard.dev",
    createdAt: "2026-05-12T08:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "u2",
    username: "algomaster",
    displayName: "算法大师",
    avatarUrl: null,
    bio: "算法工程师，专注于算法可视化。写过200+排序动画。",
    website: "",
    createdAt: "2026-04-20T12:00:00Z",
    updatedAt: "2026-07-28T15:30:00Z",
  },
  {
    id: "u3",
    username: "fourierfan",
    displayName: "傅里叶迷",
    avatarUrl: null,
    bio: "信号处理爱好者，傅里叶变换改变了我看世界的方式。",
    website: "https://fourier.fan",
    createdAt: "2026-06-01T09:00:00Z",
    updatedAt: "2026-08-05T14:00:00Z",
  },
  {
    id: "u4",
    username: "geometrygeek",
    displayName: "几何极客",
    avatarUrl: null,
    bio: "热爱古典几何与现代计算机图形学的交叉。",
    website: "",
    createdAt: "2026-03-15T16:00:00Z",
    updatedAt: "2026-07-20T11:00:00Z",
  },
  {
    id: "u5",
    username: "ml_explorer",
    displayName: "ML探险家",
    avatarUrl: null,
    bio: "用可视化理解机器学习。看梯度下降就像看水流一样自然。",
    website: "https://ml-explorer.com",
    createdAt: "2026-07-01T20:00:00Z",
    updatedAt: "2026-08-07T08:30:00Z",
  },
];

/* ─── Visualizations ─── */
export const mockVisualizations: Visualization[] = [
  {
    id: "v1",
    title: "傅里叶级数：方波的分解与合成",
    description:
      "通过叠加正弦波逐步逼近方波，直观展示傅里叶级数的核心思想。从单一正弦波开始，逐步添加奇数次谐波，最终看到方波的浮现。",
    tags: ["傅里叶变换", "信号处理", "级数"],
    sourceCode: `from manim import *

class FourierSquareWave(Scene):
    def construct(self):
        axes = Axes(x_range=[-3, 3], y_range=[-2, 2])
        self.play(Create(axes))

        wave = always_redraw(lambda: axes.plot(
            lambda x: sum(
                (4 / (n * PI)) * np.sin(n * x)
                for n in range(1, 21, 2)
            ),
            color=BLUE
        ))
        self.play(Create(wave), run_time=5)
        self.wait()`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 15,
    authorId: "u3",
    forkedFrom: null,
    likesCount: 234,
    commentsCount: 18,
    forksCount: 12,
    viewsCount: 3456,
    isPublished: true,
    createdAt: "2026-08-05T14:30:00Z",
    updatedAt: "2026-08-05T14:30:00Z",
  },
  {
    id: "v2",
    title: "梯度下降的3D可视化",
    description:
      "在三维空间中展示梯度下降算法在损失函数曲面上的轨迹。支持对比不同学习率对收敛速度和稳定性的影响。",
    tags: ["梯度下降", "机器学习", "优化"],
    sourceCode: `from manim import *

class GradientDescent3D(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=60, theta=30)
        surface = Surface(
            lambda u, v: np.array([u, v, u**2 + v**2]),
            u_range=[-2, 2], v_range=[-2, 2]
        )
        self.play(Create(surface))
        self.wait()`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 25,
    authorId: "u5",
    forkedFrom: null,
    likesCount: 456,
    commentsCount: 32,
    forksCount: 25,
    viewsCount: 6789,
    isPublished: true,
    createdAt: "2026-08-07T09:15:00Z",
    updatedAt: "2026-08-07T09:15:00Z",
  },
  {
    id: "v3",
    title: "排序算法对决：快排 vs 归并 vs 冒泡",
    description:
      "三种经典排序算法并排对比可视化。用柱状图高度表示数组元素，不同颜色标记比较和交换操作。",
    tags: ["排序算法", "计算机科学", "对比"],
    sourceCode: `from manim import *

class SortingShowdown(Scene):
    def construct(self):
        # Implementation with bar chart comparisons
        pass`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 45,
    authorId: "u2",
    forkedFrom: null,
    likesCount: 189,
    commentsCount: 15,
    forksCount: 8,
    viewsCount: 2345,
    isPublished: true,
    createdAt: "2026-08-03T11:00:00Z",
    updatedAt: "2026-08-03T11:00:00Z",
  },
  {
    id: "v4",
    title: "欧拉公式的几何直觉：e^(iπ) + 1 = 0",
    description:
      "在复平面上动画展示 e^(ix) 的轨迹，揭示欧拉公式为什么成立。用几何直觉代替纯代数推导。",
    tags: ["复数", "欧拉公式", "几何"],
    sourceCode: `from manim import *

class EulerFormula(Scene):
    def construct(self):
        plane = ComplexPlane()
        self.play(Create(plane))

        circle = Circle(radius=1, color=YELLOW)
        self.play(Create(circle))

        dot = Dot(color=RED)
        dot.move_to(plane.c2p(1, 0))
        self.play(
            MoveAlongPath(dot, circle, rate_func=linear),
            run_time=6
        )
        self.wait()`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 18,
    authorId: "u1",
    forkedFrom: null,
    likesCount: 567,
    commentsCount: 42,
    forksCount: 30,
    viewsCount: 8901,
    isPublished: true,
    createdAt: "2026-07-28T16:00:00Z",
    updatedAt: "2026-07-28T16:00:00Z",
  },
  {
    id: "v5",
    title: "椭圆曲线上的点加法",
    description:
      "几何直观展示椭圆曲线上点加法的几何意义：过两点的直线与曲线的第三个交点关于x轴的对称点。",
    tags: ["椭圆曲线", "密码学", "代数几何"],
    sourceCode: `from manim import *

class EllipticCurveAddition(Scene):
    def construct(self):
        # Show the curve y² = x³ + ax + b
        # Animate point addition geometrically
        pass`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 20,
    authorId: "u1",
    forkedFrom: null,
    likesCount: 123,
    commentsCount: 9,
    forksCount: 5,
    viewsCount: 1234,
    isPublished: true,
    createdAt: "2026-07-15T08:30:00Z",
    updatedAt: "2026-07-15T08:30:00Z",
  },
  {
    id: "v6",
    title: "正态分布的诞生：中央极限定理",
    description:
      "从均匀分布的骰子开始，逐步展示独立随机变量之和如何趋近正态分布。一个让统计学家感动的动画。",
    tags: ["概率分布", "正态分布", "统计"],
    sourceCode: `from manim import *

class CLTVisualization(Scene):
    def construct(self):
        # Show rolling dice and sum distributions
        pass`,
    videoUrl: null,
    gifUrl: null,
    posterUrl: null,
    duration: 30,
    authorId: "u4",
    forkedFrom: null,
    likesCount: 345,
    commentsCount: 26,
    viewsCount: 4567,
    forksCount: 18,
    isPublished: true,
    createdAt: "2026-08-01T13:00:00Z",
    updatedAt: "2026-08-01T13:00:00Z",
  },
];

/* ─── Articles ─── */
export const mockArticles: Article[] = [
  {
    id: "a1",
    title: "从零理解傅里叶变换：一个可视化指南",
    coverUrl: null,
    bodyMd: `# 从零理解傅里叶变换

## 引言

傅里叶变换是信号处理中最重要的数学工具之一。但它在课本上通常被扔给一堆复杂的积分公式，让人望而生畏。

**本文的目标是用可视化的方式让你直观理解它。**

## 核心思想

傅里叶变换的核心思想出奇地简单：

> 任何周期信号都可以分解为一系列正弦波的叠加。

想象你在听一首歌。这首歌是复杂的声波，但你可以把它"拆"成低音、中音、高音...每个频率对应一个正弦波。

## 从时域到频域

时域是我们最熟悉的视角——横轴是时间，纵轴是信号的幅度。

频域是"换个角度看看"——横轴是频率，纵轴是该频率的强度。

$$
\\mathcal{F}\\{f(t)\\} = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt
$$

## 可视化演示

下面这个动画展示了方波的傅里叶级数分解过程。注意看：每添加一个奇数次谐波，波形就离方波更近一步。

<viz id="v1" />

## 为什么重要？

傅里叶变换的应用无处不在：
- **音频压缩**：MP3 扔掉你听不到的高频分量
- **图像处理**：JPEG 的 DCT 就是傅里叶变换的变体
- **医学成像**：MRI 通过傅里叶变换重建图像
- **量子力学**：位置和动量的傅里叶对偶关系

## 总结

傅里叶变换不是魔法——它只是换了一个坐标系看世界。用正弦波的"语言"描述信号，很多问题会变得异常简单。`,
    embeddedViz: ["v1"],
    tags: ["傅里叶变换", "教程", "信号处理"],
    authorId: "u3",
    likesCount: 456,
    commentsCount: 24,
    collectionsCount: 89,
    viewsCount: 5678,
    isPublished: true,
    createdAt: "2026-08-06T10:00:00Z",
    updatedAt: "2026-08-06T10:00:00Z",
  },
  {
    id: "a2",
    title: "梯度下降的数学直觉：为什么往最陡的方向走？",
    coverUrl: null,
    bodyMd: `# 梯度下降的数学直觉

## 从爬山说起

想象你蒙着眼睛站在一座山上，想要下到山谷底部。最简单的方法是：**每一步都往最陡的方向走**。

这就是梯度下降的全部思想。

## 数学形式

给定损失函数 $L(\\theta)$，我们迭代更新参数：

$$\\theta_{t+1} = \\theta_t - \\eta \\nabla L(\\theta_t)$$

其中 $\\eta$ 是学习率，$\\nabla L$ 是梯度（最陡上升方向）。我们减去梯度，所以是"最陡下降"。

## 3D 可视化

下面这个可视化展示了梯度下降在 3D 损失曲面上的轨迹：

<viz id="v2" />

## 学习率的影响

- **太小**：收敛太慢，像蚂蚁下山
- **太大**：来回震荡，甚至发散
- **刚好**：平稳快速地到达谷底

## 进阶思考

梯度下降虽然简单，但它引出了现代深度学习的基础。SGD、Adam、RMSProp...都是它的变体。理解梯度下降，你就理解了神经网络训练的核心。`,
    embeddedViz: ["v2"],
    tags: ["梯度下降", "机器学习", "教程"],
    authorId: "u5",
    likesCount: 234,
    commentsCount: 16,
    collectionsCount: 67,
    viewsCount: 3456,
    isPublished: true,
    createdAt: "2026-08-07T14:00:00Z",
    updatedAt: "2026-08-07T14:00:00Z",
  },
];

/* ─── Comments ─── */
export const mockComments: Comment[] = [
  {
    id: "c1",
    body: "这太棒了！只看公式的时候完全没想到可以这样理解。可视化真的改变一切。",
    authorId: "u2",
    targetType: "visualization",
    targetId: "v1",
    parentId: null,
    likesCount: 12,
    createdAt: "2026-08-06T12:00:00Z",
    updatedAt: "2026-08-06T12:00:00Z",
  },
  {
    id: "c2",
    body: "同意！特别是看到正弦波一层层叠加的时候，方波真的浮现出来了。",
    authorId: "u4",
    targetType: "visualization",
    targetId: "v1",
    parentId: "c1",
    likesCount: 5,
    createdAt: "2026-08-06T13:00:00Z",
    updatedAt: "2026-08-06T13:00:00Z",
  },
  {
    id: "c3",
    body: "代码写得也很清晰，fork了一份打算改成三角波的版本。",
    authorId: "u5",
    targetType: "visualization",
    targetId: "v1",
    parentId: null,
    likesCount: 8,
    createdAt: "2026-08-06T15:00:00Z",
    updatedAt: "2026-08-06T15:00:00Z",
  },
  {
    id: "c4",
    body: "建议增加不同学习率对比的版本，左边放lr=0.01，右边放lr=0.1，应该很直观。",
    authorId: "u1",
    targetType: "visualization",
    targetId: "v2",
    parentId: null,
    likesCount: 15,
    createdAt: "2026-08-07T16:00:00Z",
    updatedAt: "2026-08-07T16:00:00Z",
  },
  {
    id: "c5",
    body: "好主意！我试试看能不能实现。",
    authorId: "u5",
    targetType: "visualization",
    targetId: "v2",
    parentId: "c4",
    likesCount: 3,
    createdAt: "2026-08-07T17:00:00Z",
    updatedAt: "2026-08-07T17:00:00Z",
  },
  {
    id: "c6",
    body: "这篇教程写得真好，深入浅出。傅里叶变换一直是我心中的痛，现在终于敢面对它了 😂",
    authorId: "u2",
    targetType: "article",
    targetId: "a1",
    parentId: null,
    likesCount: 20,
    createdAt: "2026-08-07T11:00:00Z",
    updatedAt: "2026-08-07T11:00:00Z",
  },
  {
    id: "c7",
    body: "「换一个坐标系看世界」这个比喻绝了！",
    authorId: "u4",
    targetType: "article",
    targetId: "a1",
    parentId: null,
    likesCount: 10,
    createdAt: "2026-08-07T12:30:00Z",
    updatedAt: "2026-08-07T12:30:00Z",
  },
];

/* ─── Helper to get profile by id ─── */
export function getProfile(id: string): Profile | undefined {
  return mockProfiles.find((p) => p.id === id);
}

/* ─── Helper to get profile by username ─── */
export function getProfileByUsername(
  username: string,
): Profile | undefined {
  return mockProfiles.find((p) => p.username === username);
}

/* ─── Build feed items from visualizations + articles ─── */
export function buildFeedItems(sort: FeedSort): FeedItem[] {
  // "followed" requires auth; fall back to "hot" for now
  const vizItems: FeedItem[] = mockVisualizations
    .filter((v) => v.isPublished)
    .map((v) => ({
      type: "visualization" as const,
      id: v.id,
      title: v.title,
      description: v.description,
      posterUrl: v.posterUrl,
      tags: v.tags,
      author: {
        id: v.authorId,
        username: getProfile(v.authorId)?.username ?? "unknown",
        displayName: getProfile(v.authorId)?.displayName ?? "Unknown",
        avatarUrl: getProfile(v.authorId)?.avatarUrl ?? null,
      },
      likesCount: v.likesCount,
      commentsCount: v.commentsCount,
      createdAt: v.createdAt,
    }));

  const articleItems: FeedItem[] = mockArticles
    .filter((a) => a.isPublished)
    .map((a) => ({
      type: "article" as const,
      id: a.id,
      title: a.title,
      description: a.bodyMd.slice(0, 150) + "...",
      coverUrl: a.coverUrl,
      posterUrl: a.coverUrl,
      tags: a.tags,
      author: {
        id: a.authorId,
        username: getProfile(a.authorId)?.username ?? "unknown",
        displayName: getProfile(a.authorId)?.displayName ?? "Unknown",
        avatarUrl: getProfile(a.authorId)?.avatarUrl ?? null,
      },
      likesCount: a.likesCount,
      commentsCount: a.commentsCount,
      createdAt: a.createdAt,
    }));

  const all = [...vizItems, ...articleItems];

  if (sort === "new") {
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else {
    // "hot": sort by likes + comments
    all.sort(
      (a, b) =>
        b.likesCount + b.commentsCount * 2 -
        (a.likesCount + a.commentsCount * 2),
    );
  }

  return all;
}

/* ─── Get visualization with author ─── */
export function getVisualizationById(
  id: string,
): Visualization | undefined {
  const viz = mockVisualizations.find((v) => v.id === id);
  if (viz) {
    viz.author = getProfile(viz.authorId);
  }
  return viz;
}

/* ─── Get article with author ─── */
export function getArticleById(id: string): Article | undefined {
  const article = mockArticles.find((a) => a.id === id);
  if (article) {
    article.author = getProfile(article.authorId);
  }
  return article;
}

/* ─── Get comments for a target ─── */
export function getCommentsForTarget(
  targetType: "visualization" | "article",
  targetId: string,
): Comment[] {
  const root = mockComments
    .filter((c) => c.targetType === targetType && c.targetId === targetId)
    .map((c) => ({ ...c, author: getProfile(c.authorId) }));

  // Build reply tree
  const topLevel = root.filter((c) => !c.parentId);
  const replies = root.filter((c) => c.parentId);

  return topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentId === c.id),
  }));
}

/* ─── Get user's works ─── */
export function getUserVisualizations(userId: string): Visualization[] {
  return mockVisualizations.filter(
    (v) => v.authorId === userId && v.isPublished,
  );
}

export function getUserArticles(userId: string): Article[] {
  return mockArticles.filter(
    (a) => a.authorId === userId && a.isPublished,
  );
}

/* ─── Search ─── */
export function searchContent(query: string): FeedItem[] {
  const q = query.toLowerCase();
  const all = buildFeedItems("new");
  return all.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      item.author.displayName.toLowerCase().includes(q) ||
      item.author.username.toLowerCase().includes(q),
  );
}

/* ─── Filter by tag ─── */
export function filterByTag(tag: string): FeedItem[] {
  const all = buildFeedItems("hot");
  return all.filter((item) =>
    item.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );
}
