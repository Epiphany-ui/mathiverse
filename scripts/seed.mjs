// Seed script — populates Mathiverse with mock data
// Usage: node scripts/seed.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
// Optionally reads SUPABASE_SERVICE_ROLE_KEY (bypasses RLS & email confirmation)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env.local manually
const envContent = readFileSync(resolve(root, ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// Use service_role key if available (bypasses RLS + email confirmation)
const key = serviceRoleKey || anonKey;
const supabase = createClient(url, key, serviceRoleKey ? { auth: { autoRefreshJwt: false } } : {});

console.log(serviceRoleKey
  ? "🔑 Using service_role key (RLS bypassed, emails auto-confirmed)"
  : "⚠️  Using anon key — email confirmation must be disabled in Supabase");

/* ─── Mock users ─── */
const USERS = [
  { email: "seed1@mathiverse.dev", password: "seed123!@#", username: "mathwizard", displayName: "数学巫师", bio: "数学PhD在读，热爱可视化一切数学概念。用动画让抽象变得直观。", website: "https://mathwizard.dev" },
  { email: "seed2@mathiverse.dev", password: "seed123!@#", username: "algomaster", displayName: "算法大师", bio: "算法工程师，专注于算法可视化。写过200+排序动画。", website: "" },
  { email: "seed3@mathiverse.dev", password: "seed123!@#", username: "fourierfan", displayName: "傅里叶迷", bio: "信号处理爱好者，傅里叶变换改变了我看世界的方式。", website: "https://fourier.fan" },
  { email: "seed4@mathiverse.dev", password: "seed123!@#", username: "geometrygeek", displayName: "几何极客", bio: "热爱古典几何与现代计算机图形学的交叉。", website: "" },
  { email: "seed5@mathiverse.dev", password: "seed123!@#", username: "ml_explorer", displayName: "ML探险家", bio: "用可视化理解机器学习。看梯度下降就像看水流一样自然。", website: "https://ml-explorer.com" },
];

/* ─── Fixed content UUIDs ─── */
const V1 = "00000000-0000-4000-8001-000000000001";
const V2 = "00000000-0000-4000-8001-000000000002";
const V3 = "00000000-0000-4000-8001-000000000003";
const V4 = "00000000-0000-4000-8001-000000000004";
const V5 = "00000000-0000-4000-8001-000000000005";
const V6 = "00000000-0000-4000-8001-000000000006";
const A1 = "00000000-0000-4000-8002-000000000001";
const A2 = "00000000-0000-4000-8002-000000000002";
const C1 = "00000000-0000-4000-8003-000000000001";
const C2 = "00000000-0000-4000-8003-000000000002";
const C3 = "00000000-0000-4000-8003-000000000003";
const C4 = "00000000-0000-4000-8003-000000000004";
const C5 = "00000000-0000-4000-8003-000000000005";
const C6 = "00000000-0000-4000-8003-000000000006";
const C7 = "00000000-0000-4000-8003-000000000007";

async function main() {
  console.log("🌱 Seeding Mathiverse...\n");

  // ─── Step 1: Create users ───
  const profileIds = {};
  console.log("Step 1: Creating users...");

  for (const user of USERS) {
    if (serviceRoleKey) {
      // Admin API: create user directly, confirmed
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u) => u.email === user.email);
      if (found) {
        console.log(`  ⏭️  ${user.username} (already exists)`);
        profileIds[user.username] = found.id;
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          username: user.username,
          display_name: user.displayName,
          bio: user.bio,
          website: user.website,
        },
      });

      if (error) {
        console.error(`  ❌ ${user.username}: ${error.message}`);
      } else {
        console.log(`  ✅ ${user.username} → ${data.user.id}`);
        profileIds[user.username] = data.user.id;
      }
    } else {
      // Anon signUp — relies on trigger for profile creation
      // May need email confirmation disabled in Supabase Dashboard
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            username: user.username,
            display_name: user.displayName,
            bio: user.bio,
            website: user.website,
          },
        },
      });

      if (error) {
        // If user already exists, try to look up their profile
        if (error.message.includes("already") || error.message.includes("exists")) {
          console.log(`  ⏭️  ${user.username} (already registered, looking up...)`);
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", user.username)
            .single();
          if (profile) {
            profileIds[user.username] = profile.id;
            console.log(`  ✅ ${user.username} → ${profile.id} (found existing profile)`);
          }
        } else {
          console.error(`  ❌ ${user.username}: ${error.message}`);
        }
      } else if (data.user) {
        console.log(`  ✅ ${user.username} → ${data.user.id}`);
        profileIds[user.username] = data.user.id;
      }
    }
  }

  // Verify we have all profiles
  const missing = USERS.filter((u) => !profileIds[u.username]);
  if (missing.length > 0) {
    console.error(`\n❌ Missing ${missing.length} profiles: ${missing.map((u) => u.username).join(", ")}`);
    if (!serviceRoleKey) {
      console.error("   Try adding SUPABASE_SERVICE_ROLE_KEY to .env.local");
    }
    process.exit(1);
  }

  // Also update profile details (trigger only sets basic fields)
  if (serviceRoleKey) {
    console.log("\nStep 1b: Updating profile details...");
    for (const user of USERS) {
      const { error } = await supabase
        .from("profiles")
        .update({
          bio: user.bio,
          website: user.website,
          display_name: user.displayName,
        })
        .eq("id", profileIds[user.username]);
      if (error) {
        console.log(`  ⚠️  ${user.username} profile update: ${error.message}`);
      } else {
        console.log(`  ✅ ${user.username} profile updated`);
      }
    }
  }

  // ─── Step 2: Insert visualizations ───
  console.log("\nStep 2: Inserting visualizations...");

  const visualizations = [
    {
      id: V1, title: "傅里叶级数：方波的分解与合成",
      description: "通过叠加正弦波逐步逼近方波，直观展示傅里叶级数的核心思想。从单一正弦波开始，逐步添加奇数次谐波，最终看到方波的浮现。",
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
      duration: 15, authorUsername: "fourierfan",
      likesCount: 234, commentsCount: 18, forksCount: 12, viewsCount: 3456,
      createdAt: "2026-08-05T14:30:00Z",
    },
    {
      id: V2, title: "梯度下降的3D可视化",
      description: "在三维空间中展示梯度下降算法在损失函数曲面上的轨迹。支持对比不同学习率对收敛速度和稳定性的影响。",
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
      duration: 25, authorUsername: "ml_explorer",
      likesCount: 456, commentsCount: 32, forksCount: 25, viewsCount: 6789,
      createdAt: "2026-08-07T09:15:00Z",
    },
    {
      id: V3, title: "排序算法对决：快排 vs 归并 vs 冒泡",
      description: "三种经典排序算法并排对比可视化。用柱状图高度表示数组元素，不同颜色标记比较和交换操作。",
      tags: ["排序算法", "计算机科学", "对比"],
      sourceCode: `from manim import *

class SortingShowdown(Scene):
    def construct(self):
        # Implementation with bar chart comparisons
        pass`,
      duration: 45, authorUsername: "algomaster",
      likesCount: 189, commentsCount: 15, forksCount: 8, viewsCount: 2345,
      createdAt: "2026-08-03T11:00:00Z",
    },
    {
      id: V4, title: "欧拉公式的几何直觉：e^(iπ) + 1 = 0",
      description: "在复平面上动画展示 e^(ix) 的轨迹，揭示欧拉公式为什么成立。用几何直觉代替纯代数推导。",
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
      duration: 18, authorUsername: "mathwizard",
      likesCount: 567, commentsCount: 42, forksCount: 30, viewsCount: 8901,
      createdAt: "2026-07-28T16:00:00Z",
    },
    {
      id: V5, title: "椭圆曲线上的点加法",
      description: "几何直观展示椭圆曲线上点加法的几何意义：过两点的直线与曲线的第三个交点关于x轴的对称点。",
      tags: ["椭圆曲线", "密码学", "代数几何"],
      sourceCode: `from manim import *

class EllipticCurveAddition(Scene):
    def construct(self):
        # Show the curve y² = x³ + ax + b
        # Animate point addition geometrically
        pass`,
      duration: 20, authorUsername: "mathwizard",
      likesCount: 123, commentsCount: 9, forksCount: 5, viewsCount: 1234,
      createdAt: "2026-07-15T08:30:00Z",
    },
    {
      id: V6, title: "正态分布的诞生：中央极限定理",
      description: "从均匀分布的骰子开始，逐步展示独立随机变量之和如何趋近正态分布。一个让统计学家感动的动画。",
      tags: ["概率分布", "正态分布", "统计"],
      sourceCode: `from manim import *

class CLTVisualization(Scene):
    def construct(self):
        # Show rolling dice and sum distributions
        pass`,
      duration: 30, authorUsername: "geometrygeek",
      likesCount: 345, commentsCount: 26, viewsCount: 4567, forksCount: 18,
      createdAt: "2026-08-01T13:00:00Z",
    },
  ];

  for (const v of visualizations) {
    const { error } = await supabase.from("visualizations").upsert({
      id: v.id,
      title: v.title,
      description: v.description,
      tags: v.tags,
      source_code: v.sourceCode,
      duration: v.duration,
      author_id: profileIds[v.authorUsername],
      likes_count: v.likesCount,
      comments_count: v.commentsCount,
      forks_count: v.forksCount,
      views_count: v.viewsCount,
      is_published: true,
      created_at: v.createdAt,
      updated_at: v.createdAt,
    }, { onConflict: "id" });

    if (error) {
      console.error(`  ❌ ${v.title}: ${error.message}`);
    } else {
      console.log(`  ✅ ${v.title}`);
    }
  }

  // ─── Step 3: Insert articles ───
  console.log("\nStep 3: Inserting articles...");

  const articles = [
    {
      id: A1, title: "从零理解傅里叶变换：一个可视化指南",
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

<viz id="${V1}" />

## 为什么重要？

傅里叶变换的应用无处不在：
- **音频压缩**：MP3 扔掉你听不到的高频分量
- **图像处理**：JPEG 的 DCT 就是傅里叶变换的变体
- **医学成像**：MRI 通过傅里叶变换重建图像
- **量子力学**：位置和动量的傅里叶对偶关系

## 总结

傅里叶变换不是魔法——它只是换了一个坐标系看世界。用正弦波的"语言"描述信号，很多问题会变得异常简单。`,
      embeddedViz: [V1], tags: ["傅里叶变换", "教程", "信号处理"],
      authorUsername: "fourierfan",
      likesCount: 456, commentsCount: 24, collectionsCount: 89, viewsCount: 5678,
      createdAt: "2026-08-06T10:00:00Z",
    },
    {
      id: A2, title: "梯度下降的数学直觉：为什么往最陡的方向走？",
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

<viz id="${V2}" />

## 学习率的影响

- **太小**：收敛太慢，像蚂蚁下山
- **太大**：来回震荡，甚至发散
- **刚好**：平稳快速地到达谷底

## 进阶思考

梯度下降虽然简单，但它引出了现代深度学习的基础。SGD、Adam、RMSProp...都是它的变体。理解梯度下降，你就理解了神经网络训练的核心。`,
      embeddedViz: [V2], tags: ["梯度下降", "机器学习", "教程"],
      authorUsername: "ml_explorer",
      likesCount: 234, commentsCount: 16, collectionsCount: 67, viewsCount: 3456,
      createdAt: "2026-08-07T14:00:00Z",
    },
  ];

  for (const a of articles) {
    const { error } = await supabase.from("articles").upsert({
      id: a.id,
      title: a.title,
      body_md: a.bodyMd,
      embedded_viz: a.embeddedViz,
      tags: a.tags,
      author_id: profileIds[a.authorUsername],
      likes_count: a.likesCount,
      comments_count: a.commentsCount,
      collections_count: a.collectionsCount,
      views_count: a.viewsCount,
      is_published: true,
      created_at: a.createdAt,
      updated_at: a.createdAt,
    }, { onConflict: "id" });

    if (error) {
      console.error(`  ❌ ${a.title}: ${error.message}`);
    } else {
      console.log(`  ✅ ${a.title}`);
    }
  }

  // ─── Step 4: Insert comments ───
  console.log("\nStep 4: Inserting comments...");

  const comments = [
    { id: C1, body: "这太棒了！只看公式的时候完全没想到可以这样理解。可视化真的改变一切。", authorUsername: "algomaster", targetType: "visualization", targetId: V1, parentId: null, likesCount: 12, createdAt: "2026-08-06T12:00:00Z" },
    { id: C2, body: "同意！特别是看到正弦波一层层叠加的时候，方波真的浮现出来了。", authorUsername: "geometrygeek", targetType: "visualization", targetId: V1, parentId: C1, likesCount: 5, createdAt: "2026-08-06T13:00:00Z" },
    { id: C3, body: "代码写得也很清晰，fork了一份打算改成三角波的版本。", authorUsername: "ml_explorer", targetType: "visualization", targetId: V1, parentId: null, likesCount: 8, createdAt: "2026-08-06T15:00:00Z" },
    { id: C4, body: "建议增加不同学习率对比的版本，左边放lr=0.01，右边放lr=0.1，应该很直观。", authorUsername: "mathwizard", targetType: "visualization", targetId: V2, parentId: null, likesCount: 15, createdAt: "2026-08-07T16:00:00Z" },
    { id: C5, body: "好主意！我试试看能不能实现。", authorUsername: "ml_explorer", targetType: "visualization", targetId: V2, parentId: C4, likesCount: 3, createdAt: "2026-08-07T17:00:00Z" },
    { id: C6, body: "这篇教程写得真好，深入浅出。傅里叶变换一直是我心中的痛，现在终于敢面对它了 😂", authorUsername: "algomaster", targetType: "article", targetId: A1, parentId: null, likesCount: 20, createdAt: "2026-08-07T11:00:00Z" },
    { id: C7, body: "「换一个坐标系看世界」这个比喻绝了！", authorUsername: "geometrygeek", targetType: "article", targetId: A1, parentId: null, likesCount: 10, createdAt: "2026-08-07T12:30:00Z" },
  ];

  for (const c of comments) {
    const { error } = await supabase.from("comments").upsert({
      id: c.id,
      body: c.body,
      author_id: profileIds[c.authorUsername],
      target_type: c.targetType,
      target_id: c.targetId,
      parent_id: c.parentId,
      likes_count: c.likesCount,
      created_at: c.createdAt,
      updated_at: c.createdAt,
    }, { onConflict: "id" });

    if (error) {
      console.error(`  ❌ comment ${c.id}: ${error.message}`);
    } else {
      console.log(`  ✅ comment ${c.id}`);
    }
  }

  // ─── Step 5: Insert likes ───
  console.log("\nStep 5: Inserting likes...");
  const likes = [
    { userId: profileIds.algomaster, targetType: "visualization", targetId: V1 },
    { userId: profileIds.geometrygeek, targetType: "visualization", targetId: V1 },
    { userId: profileIds.ml_explorer, targetType: "visualization", targetId: V1 },
    { userId: profileIds.fourierfan, targetType: "visualization", targetId: V2 },
    { userId: profileIds.mathwizard, targetType: "visualization", targetId: V2 },
    { userId: profileIds.ml_explorer, targetType: "article", targetId: A1 },
    { userId: profileIds.algomaster, targetType: "article", targetId: A1 },
  ];

  let likeCount = 0;
  for (const l of likes) {
    const { error } = await supabase.from("likes").upsert(l, { onConflict: "user_id,target_type,target_id" });
    if (!error) likeCount++;
  }
  console.log(`  ✅ ${likeCount} likes inserted`);

  // ─── Step 6: Insert follows ───
  console.log("\nStep 6: Inserting follows...");
  const follows = [
    { followerId: profileIds.mathwizard, followingId: profileIds.fourierfan },
    { followerId: profileIds.mathwizard, followingId: profileIds.ml_explorer },
    { followerId: profileIds.fourierfan, followingId: profileIds.mathwizard },
    { followerId: profileIds.algomaster, followingId: profileIds.ml_explorer },
    { followerId: profileIds.ml_explorer, followingId: profileIds.geometrygeek },
  ];

  let followCount = 0;
  for (const f of follows) {
    const { error } = await supabase.from("follows").upsert(f, { onConflict: "follower_id,following_id" });
    if (!error) followCount++;
  }
  console.log(`  ✅ ${followCount} follows inserted`);

  console.log("\n🎉 Seed complete!");
  console.log(`   ${Object.keys(profileIds).length} users`);
  console.log(`   ${visualizations.length} visualizations`);
  console.log(`   ${articles.length} articles`);
  console.log(`   ${comments.length} comments`);
  console.log("   Run 'pnpm dev' and open http://localhost:3000 to see the data!");
}

main().catch((err) => {
  console.error("💥 Seed failed:", err.message);
  process.exit(1);
});
