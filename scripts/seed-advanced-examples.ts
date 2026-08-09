#!/usr/bin/env npx tsx
/**
 * Seed advanced Manim examples into the RAG vector store.
 * Usage: npx tsx scripts/seed-advanced-examples.ts [--force]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Manually load .env.local
function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.warn("[seed] Could not load .env.local");
  }
}
loadEnvLocal();

import { isOllamaRunning } from "../src/lib/ai/embedding";
import { insertExample, countExamples } from "../src/lib/ai/retrieval";

// ═══════════════════════════════════════════════════════════════════════
// Advanced Manim examples — curated for complex math/physics visualization
// ═══════════════════════════════════════════════════════════════════════

interface AdvancedExample {
  title: string;
  description: string;
  code: string;
  tags: string[];
}

const ADVANCED_EXAMPLES: AdvancedExample[] = [
  // ─── 1. Lorenz Attractor (Chaos Theory) ───
  {
    title: "洛伦兹吸引子——混沌系统的蝴蝶效应",
    description: "在三维空间中展示洛伦兹系统的混沌轨迹，两条几乎相同的初始条件随时间指数分离，直观展示确定性混沌和蝴蝶效应",
    tags: ["3D", "混沌", "微分方程", "轨迹", "物理"],
    code: `from manim import *
import numpy as np

class LorenzAttractor(ThreeDScene):
    def construct(self):
        # 设置3D相机视角
        self.set_camera_orientation(phi=65 * DEGREES, theta=-50 * DEGREES)

        title = MathTex(
            r"\\text{洛伦兹吸引子：}\\sigma=10,\\ \\rho=28,\\ \\beta=8/3",
            font_size=36, color=YELLOW
        ).to_edge(UP)
        self.add_fixed_in_frame_mobjects(title)
        self.play(Write(title))

        # 洛伦兹系统的微分方程
        sigma, rho, beta = 10.0, 28.0, 8.0 / 3.0
        dt = 0.005

        def lorenz_deriv(state):
            x, y, z = state
            return np.array([sigma * (y - x), x * (rho - z) - y, x * y - beta * z])

        # 生成两条轨迹——初始条件只有z差0.01
        def compute_trajectory(init, steps=6000):
            points = [init]
            state = np.array(init, dtype=float)
            for _ in range(steps):
                state += lorenz_deriv(state) * dt
                points.append(state.copy())
            return np.array(points)

        traj1 = compute_trajectory([1.0, 1.0, 1.0])
        traj2 = compute_trajectory([1.0, 1.0, 1.01])

        # 缩放到画面坐标
        scale = 0.2
        axes = ThreeDAxes(
            x_range=[-20, 20, 10], y_range=[-30, 30, 10], z_range=[0, 50, 10],
            x_length=5, y_length=5, z_length=5,
        )
        self.play(Create(axes))

        # 轨迹1（蓝色）和轨迹2（红色）渐次绘制
        dot1 = Dot3D(color=BLUE, radius=0.05)
        dot2 = Dot3D(color=RED, radius=0.05)
        self.add(dot1, dot2)

        trail1 = TracingTail(dot1, stroke_color=BLUE, stroke_width=1.5, stroke_opacity=0.7)
        trail2 = TracingTail(dot2, stroke_color=RED, stroke_width=1.5, stroke_opacity=0.7)
        self.add(trail1, trail2)

        self.begin_ambient_camera_rotation(rate=0.3)

        # 动画：两条轨迹逐渐分离
        step = 30
        for i in range(0, len(traj1), step):
            p1 = traj1[i] * scale
            p2 = traj2[i] * scale
            self.play(
                dot1.animate.move_to(p1),
                dot2.animate.move_to(p2),
                run_time=0.03,
                rate_func=linear,
            )

        self.stop_ambient_camera_rotation()
        self.wait(2)`,
  },

  // ─── 2. Gradient Descent on 3D Surface ───
  {
    title: "梯度下降——在三维损失曲面上寻找最小值",
    description: "3D曲面上的梯度下降可视化：小球从高点出发，沿最陡下降方向滚动到局部最小值，展示ML优化核心算法",
    tags: ["3D", "优化", "机器学习", "微积分", "曲面"],
    code: `from manim import *
import numpy as np

class GradientDescent3D(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=60 * DEGREES, theta=-45 * DEGREES)

        title = MathTex(
            r"\\text{梯度下降：}\\ z = x^2 + 3y^2",
            font_size=38, color=YELLOW
        ).to_edge(UP)
        self.add_fixed_in_frame_mobjects(title)

        # 定义损失函数 f(x,y) = x² + 3y²（椭圆形等高线）
        def f(x, y):
            return x**2 + 3 * y**2

        def grad(x, y):
            return np.array([2 * x, 6 * y])

        # 三维曲面
        surface = Surface(
            lambda u, v: np.array([u, v, f(u, v) * 0.3]),
            u_range=[-3, 3], v_range=[-2, 2],
            resolution=(40, 30),
            fill_opacity=0.6,
        )
        surface.set_color_by_gradient(BLUE_D, BLUE_E, TEAL_D)
        self.play(Create(surface), run_time=2)

        # 坐标轴
        axes = ThreeDAxes(
            x_range=[-3, 3, 1], y_range=[-2, 2, 1], z_range=[0, 12, 2],
            x_length=6, y_length=4, z_length=4,
        )
        self.play(Create(axes))

        # 梯度下降迭代
        lr = 0.25  # 学习率
        pos = np.array([2.5, 1.8])  # 起始位置
        positions = [pos]
        for _ in range(15):
            g = grad(*pos)
            pos = pos - lr * g
            positions.append(pos.copy())
            if np.linalg.norm(g) < 0.01:
                break

        # 可视化下降路径
        ball = Sphere(radius=0.1, color=RED).move_to(
            axes.c2p(positions[0][0], positions[0][1]) + np.array([0, 0, f(*positions[0]) * 0.3])
        )
        self.add(ball)

        path_points = [axes.c2p(p[0], p[1]) + np.array([0, 0, f(*p) * 0.3]) for p in positions]
        path = VMobject(color=YELLOW, stroke_width=3)
        path.set_points_smoothly(path_points)

        self.play(
            MoveAlongPath(ball, path, rate_func=linear),
            Create(path),
            run_time=5,
        )

        # 到达最小值标记
        min_dot = Dot3D(
            axes.c2p(0, 0) + np.array([0, 0, f(0, 0) * 0.3]),
            color=GREEN, radius=0.1
        )
        self.play(FadeIn(min_dot))

        conclusion = MathTex(r"\\text{找到最小值！}", font_size=36, color=GREEN)
        conclusion.to_edge(DOWN)
        self.add_fixed_in_frame_mobjects(conclusion)
        self.play(Write(conclusion))
        self.wait(2)`,
  },

  // ─── 3. Mandelbrot Set Zoom ───
  {
    title: "曼德勃罗集合——无限深度分形缩放",
    description: "从全景逐步放大曼德勃罗集合边界，展示无穷自相似结构和分形之美，每次放大呈现全新的细节",
    tags: ["分形", "复数", "缩放", "几何", "迭代"],
    code: `from manim import *
import numpy as np

class MandelbrotZoom(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{曼德勃罗集合：}\\ z_{n+1} = z_n^2 + c",
            font_size=40, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        def mandelbrot(c, max_iter=100):
            z = 0
            for i in range(max_iter):
                if abs(z) > 2:
                    return i
                z = z * z + c
            return max_iter

        def render_frame(x_center, y_center, zoom, size=256):
            pixels = np.zeros((size, size))
            half_w, half_h = 1.5 / zoom, 1.5 / zoom * size / size
            for i in range(size):
                for j in range(size):
                    re = x_center + (j - size / 2) * 2 * half_w / size
                    im = y_center + (i - size / 2) * 2 * half_h / size
                    pixels[i, j] = mandelbrot(complex(re, im)) / 100
            return pixels

        # 创建ImageMobject来显示曼德勃罗集
        def make_image(x, y, z):
            pixels = render_frame(x, y, z)
            # 转换为RGB图像
            rgb = np.zeros((*pixels.shape, 3))
            rgb[:, :, 0] = pixels * 0.5
            rgb[:, :, 1] = pixels * 0.3
            rgb[:, :, 2] = pixels
            return ImageMobject(rgb).scale_to_fit_height(6)

        # 起始视角：全景
        img = make_image(-0.5, 0, 1)
        self.play(FadeIn(img))

        # 阶段1：放大到边界区域
        coords_label = MathTex(
            r"c \\approx -0.5 + 0i", font_size=28
        ).to_corner(DR)
        self.play(Write(coords_label))

        # 动画缩放——模拟逐渐深入
        for zoom_level in [2, 5, 10, 20, 50, 100]:
            new_img = make_image(-0.743643, 0.131825, zoom_level)
            new_label = MathTex(
                rf"\\text{{缩放}}\\times {zoom_level}", font_size=28
            ).to_corner(DR)
            self.play(
                Transform(img, new_img),
                Transform(coords_label, new_label),
                run_time=1.5,
            )
            self.wait(0.2)

        final = MathTex(
            r"\\text{无穷自相似!", font_size=44, color=GREEN
        ).to_edge(DOWN)
        self.play(Write(final))
        self.wait(2)`,
  },

  // ─── 4. Quantum Double-Slit Experiment ───
  {
    title: "量子力学——电子双缝干涉实验",
    description: "模拟电子逐个通过双缝后在屏幕上形成干涉条纹，展示波粒二象性和量子力学的概率解释",
    tags: ["物理", "量子力学", "波", "干涉", "概率"],
    code: `from manim import *
import numpy as np

class DoubleSlitExperiment(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{电子双缝干涉——波粒二象性}",
            font_size=38, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        # 双缝屏障
        barrier = Rectangle(width=0.15, height=3.0, color=WHITE, fill_opacity=1)
        slit_gap = 0.3
        slit1 = Rectangle(width=0.15, height=0.6, color=BLACK, fill_opacity=1)
        slit1.move_to(barrier.get_center() + UP * 0.75)
        slit2 = Rectangle(width=0.15, height=0.6, color=BLACK, fill_opacity=1)
        slit2.move_to(barrier.get_center() + DOWN * 0.75)
        barrier_group = VGroup(barrier, slit1, slit2)
        barrier_group.shift(LEFT * 2.5)
        self.play(Create(barrier_group))

        # 屏幕
        screen = Rectangle(width=0.1, height=5, color=GRAY, fill_opacity=0.5)
        screen.shift(RIGHT * 3.0)
        screen_label = MathTex(r"\\text{屏幕}", font_size=24).next_to(screen, UP)
        self.play(Create(screen), Write(screen_label))

        # 电子发射器
        emitter = Dot(LEFT * 5, color=BLUE, radius=0.15)
        emitter_label = Text("e⁻", font_size=20, color=BLUE).next_to(emitter, DOWN)
        self.play(FadeIn(emitter), Write(emitter_label))

        # 干涉图案积累——用累积直方图表示
        hit_bins = np.zeros(80)
        bin_centers = np.linspace(-2.5, 2.5, 80)

        bars = VGroup()
        for i in range(80):
            bar = Rectangle(width=5/80, height=0.01, color=BLUE, fill_opacity=0.6)
            bar.move_to(screen.get_center() + RIGHT * 0.15 + UP * bin_centers[i])
            bars.add(bar)

        self.play(FadeIn(bars))

        # 模拟电子逐个到达屏幕
        rng = np.random.default_rng(42)
        n_electrons = 400
        batch_size = 20

        counter = MathTex(r"N = 0", font_size=28).to_corner(DR)
        self.play(Write(counter))

        for batch_start in range(0, n_electrons, batch_size):
            for _ in range(batch_size):
                # 用量子力学的概率分布采样落点
                # 近似：两个缝的干涉 = 双缝衍射模式
                theta = rng.uniform(-np.pi / 3, np.pi / 3)
                phase_diff = 2 * np.pi * slit_gap * np.sin(theta) / 0.1
                prob = (np.cos(phase_diff / 2)) ** 2
                if rng.random() < prob:
                    bin_idx = int((np.sin(theta) / np.sin(np.pi / 3)) * 39 + 40)
                    bin_idx = max(0, min(79, bin_idx))
                    hit_bins[bin_idx] += 1

            # 更新柱子高度
            max_h = max(hit_bins.max(), 1)
            batch_num = batch_start + batch_size
            new_counter = MathTex(rf"N = {batch_num}", font_size=28).to_corner(DR)

            animations = [Transform(counter, new_counter)]
            for i in range(80):
                new_h = hit_bins[i] / max_h * 2.0
                new_bar = Rectangle(
                    width=5/80, height=max(new_h, 0.01),
                    color=interpolate_color(BLUE, RED, new_h / 2.0),
                    fill_opacity=0.7,
                )
                new_bar.move_to(bars[i].get_center())
                animations.append(Transform(bars[i], new_bar))

            self.play(*animations, run_time=0.5)

        final_label = MathTex(
            r"\\text{干涉条纹出现！}", font_size=36, color=GREEN
        ).to_edge(DOWN)
        self.play(Write(final_label))
        self.wait(2)`,
  },

  // ─── 5. Fourier Epicycle Drawing ───
  {
    title: "傅里叶外摆线——用旋转的圆画出任意形状",
    description: "傅里叶级数的几何诠释：多个旋转的圆首尾相连，末端追踪出任意闭合曲线——展示频域如何构建时域形状",
    tags: ["傅里叶", "几何", "轨迹", "圆周运动", "信号处理"],
    code: `from manim import *
import numpy as np

class FourierEpicycle(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{傅里叶外摆线：用圆画出任意形状}",
            font_size=36, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        # 预定义一个心形路径的傅里叶系数
        # 从路径中提取傅里叶描述子（简化为前6项）
        fourier_coeffs = [
            (0.0 + 0.3j, 1),    # 基频
            (0.15 + 0.05j, 2),  # 2倍频
            (-0.08 + 0.1j, 3),  # 3倍频
            (0.04 - 0.03j, 4),  # 4倍频
            (-0.02 + 0.01j, 5), # 5倍频
            (0.01 + 0.02j, 6),  # 6倍频
        ]

        n_terms = len(fourier_coeffs)

        # 创建坐标系（把原点放在中间偏左）
        axes = Axes(
            x_range=[-4, 4, 1], y_range=[-3, 3, 1],
            x_length=8, y_length=6,
        )
        self.play(Create(axes))

        # 轨迹
        trail = TracedPath(
            lambda: circles[-1].get_end(),
            stroke_color=YELLOW,
            stroke_width=3,
            stroke_opacity=0.8,
        )
        self.add(trail)

        # 每个傅里叶分量对应一个旋转的向量（圆+半径）
        circles: list[Circle] = []
        radii: list[Line] = []

        origin = axes.c2p(0, 0)
        for coeff, freq in fourier_coeffs:
            radius = abs(coeff) * 1.5
            circle = Circle(radius=radius, color=BLUE_D, stroke_width=1, stroke_opacity=0.4)
            circles.append(circle)
            radius_line = Line(ORIGIN, RIGHT * radius, color=BLUE, stroke_width=2)
            radii.append(radius_line)
            self.add(circle, radius_line)

        # 合成点
        dot = Dot(color=RED, radius=0.08)
        self.add(dot)

        # 旋转动画——模拟外摆线
        t_tracker = ValueTracker(0)
        freq_multipliers = [f for _, f in fourier_coeffs]

        def update_epicycles():
            t = t_tracker.get_value()
            current_center = origin
            for i, (coeff, _) in enumerate(fourier_coeffs):
                angle = freq_multipliers[i] * t + np.angle(coeff)
                radius = abs(coeff) * 1.5
                circles[i].move_to(current_center)
                end_pt = current_center + np.array([
                    radius * np.cos(angle),
                    radius * np.sin(angle),
                    0
                ])
                radii[i].put_start_and_end_on(current_center, end_pt)
                current_center = end_pt
            dot.move_to(current_center)

        for mob in [*circles, *radii, dot]:
            mob.add_updater(lambda m, i=i: update_epicycles())

        self.play(
            t_tracker.animate.set_value(4 * TAU),
            run_time=12,
            rate_func=linear,
        )

        for mob in [*circles, *radii, dot]:
            mob.remove_updater(update_epicycles)

        self.wait(2)`,
  },

  // ─── 6. Neural Network Forward Pass ───
  {
    title: "神经网络前向传播——矩阵乘法的几何可视化",
    description: "将神经网络的每一层可视化为对输入空间的线性+非线性变换，展示从原始数据到分类决策边界的全过程",
    tags: ["机器学习", "神经网络", "线性代数", "变换", "分类"],
    code: `from manim import *
import numpy as np

class NeuralNetworkForward(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{神经网络：从输入到分类的几何变换}",
            font_size=34, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        # 展示一个2层网络对二维点集的分类
        rng = np.random.default_rng(123)

        # 生成两个高斯簇的数据点
        n_points = 80
        cluster1 = rng.normal(loc=[-1.5, 0], scale=0.6, size=(n_points // 2, 2))
        cluster2 = rng.normal(loc=[1.5, 0], scale=0.6, size=(n_points // 2, 2))
        points = np.vstack([cluster1, cluster2])
        labels = np.array([0] * (n_points // 2) + [1] * (n_points // 2))

        # 输入空间坐标
        input_axes = Axes(
            x_range=[-4, 4, 1], y_range=[-2.5, 2.5, 1],
            x_length=4, y_length=4,
        ).shift(LEFT * 2.5)
        input_label = MathTex(r"\\text{输入空间}", font_size=24).next_to(input_axes, DOWN)

        self.play(Create(input_axes), Write(input_label))

        # 绘制数据点
        dots = VGroup()
        for i, (x, y) in enumerate(points):
            color = BLUE if labels[i] == 0 else RED
            dot = Dot(input_axes.c2p(x, y), color=color, radius=0.04)
            dots.add(dot)

        self.play(FadeIn(dots), run_time=1.5)

        # 网络结构图（简化）
        layers = [
            MathTex(r"\\mathbf{x}", font_size=20, color=WHITE),
            MathTex(r"\\mathbf{W}_1", font_size=20, color=TEAL),
            MathTex(r"\\sigma", font_size=20, color=ORANGE),
            MathTex(r"\\mathbf{W}_2", font_size=20, color=TEAL),
            MathTex(r"\\hat{y}", font_size=20, color=GREEN),
        ]
        layer_group = VGroup(*layers).arrange(RIGHT, buff=0.8).shift(UP * 2.7)
        arrows = VGroup()
        for i in range(len(layers) - 1):
            arrow = Arrow(
                layers[i].get_right() + RIGHT * 0.05,
                layers[i + 1].get_left() + LEFT * 0.05,
                buff=0, color=GRAY, stroke_width=1.5,
            )
            arrows.add(arrow)
        self.play(Write(layer_group), Create(arrows))

        # 决策边界动画
        boundary_axes = Axes(
            x_range=[-3, 3, 1], y_range=[-2, 2, 1],
            x_length=4, y_length=4,
        ).shift(RIGHT * 2.5)
        boundary_label = MathTex(r"\\text{特征空间}", font_size=24).next_to(boundary_axes, DOWN)
        self.play(Create(boundary_axes), Write(boundary_label))

        # Layer 1: 线性变换 + ReLU
        W1 = np.array([[0.8, -0.3], [0.2, 0.9]])
        hidden = points @ W1.T
        hidden = np.maximum(0, hidden)  # ReLU

        hidden_dots = VGroup()
        for i, (x, y) in enumerate(hidden):
            color = BLUE if labels[i] == 0 else RED
            dot = Dot(boundary_axes.c2p(x, y), color=color, radius=0.04)
            hidden_dots.add(dot)

        self.play(Transform(dots, hidden_dots), run_time=2)

        # 非线性变换描述
        transform_desc = MathTex(
            r"\\mathbf{h} = \\max(0, \\mathbf{x}\\mathbf{W}_1)",
            font_size=24, color=TEAL,
        ).to_edge(DOWN)
        self.play(Write(transform_desc))
        self.wait(1)

        # 最终分类结果
        final_label = MathTex(
            r"\\text{线性可分！}", font_size=32, color=GREEN
        ).to_corner(DR)
        self.play(Write(final_label))
        self.wait(2)`,
  },

  // ─── 7. Special Relativity — Spacetime Diagram ───
  {
    title: "狭义相对论——时空图与洛伦兹变换",
    description: "可视化闵可夫斯基时空图：展示洛伦兹变换如何压缩和旋转时空坐标轴，解释同时性的相对性和时间膨胀",
    tags: ["物理", "相对论", "时空", "变换", "坐标系"],
    code: `from manim import *
import numpy as np

class SpacetimeDiagram(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{狭义相对论：洛伦兹变换与时空图}",
            font_size=34, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        # 闵可夫斯基时空图（静止参考系S）
        axes = Axes(
            x_range=[-3, 3, 1], y_range=[-3, 3, 1],
            x_length=6, y_length=6,
            axis_config={"include_numbers": True},
        )
        x_label = axes.get_x_axis_label(MathTex(r"x"))
        t_label = axes.get_y_axis_label(MathTex(r"ct"))
        self.play(Create(axes), Write(x_label), Write(t_label))

        # 光锥（45°线）
        lightcone1 = DashedLine(
            axes.c2p(-3, -3), axes.c2p(3, 3),
            color=YELLOW, stroke_width=2, dash_length=0.15,
        )
        lightcone2 = DashedLine(
            axes.c2p(-3, 3), axes.c2p(3, -3),
            color=YELLOW, stroke_width=2, dash_length=0.15,
        )
        light_label = MathTex(
            r"c=1", font_size=24, color=YELLOW
        ).next_to(lightcone1, RIGHT)
        self.play(Create(lightcone1), Create(lightcone2), Write(light_label))

        # 静止参考系S的坐标轴
        x_axis = Line(axes.c2p(-2.5, 0), axes.c2p(2.5, 0), color=WHITE, stroke_width=4)
        ct_axis = Line(axes.c2p(0, -2.5), axes.c2p(0, 2.5), color=WHITE, stroke_width=4)

        # 以速度v=0.6c运动的参考系S'的坐标轴（洛伦兹变换）
        v = 0.6
        gamma = 1 / np.sqrt(1 - v**2)

        # S'的x'轴和ct'轴在S中的投影
        x_prime_end = axes.c2p(2.5, v * 2.5)  # t' = vx 线
        ct_prime_end = axes.c2p(v * 2.5, 2.5)  # x' = vt 线

        x_prime_axis = Line(axes.c2p(-2.5, v * -2.5), x_prime_end, color=BLUE, stroke_width=3)
        ct_prime_axis = Line(axes.c2p(v * -2.5, -2.5), ct_prime_end, color=RED, stroke_width=3)

        # 动画：坐标轴从S旋转到S'
        self.play(
            Create(x_prime_axis),
            Create(ct_prime_axis),
            run_time=2,
        )

        xp_label = MathTex(r"x'", font_size=28, color=BLUE).next_to(x_prime_axis, UP)
        ctp_label = MathTex(r"ct'", font_size=28, color=RED).next_to(ct_prime_axis, LEFT)
        self.play(Write(xp_label), Write(ctp_label))

        # 事件：在S中是同时的，在S'中不是
        event_A = Dot(axes.c2p(-1.5, 1.5), color=ORANGE, radius=0.08)
        event_B = Dot(axes.c2p(1.5, 1.5), color=ORANGE, radius=0.08)
        a_label = MathTex(r"A", font_size=24, color=ORANGE).next_to(event_A, UP)
        b_label = MathTex(r"B", font_size=24, color=ORANGE).next_to(event_B, UP)

        self.play(FadeIn(event_A), FadeIn(event_B), Write(a_label), Write(b_label))

        # 在S中同时（t相同），但在S'中t'不同
        relativity = MathTex(
            r"\\text{在 }S\\text{ 中同时，在 }S'\\text{ 中不同时！}",
            font_size=28, color=ORANGE
        ).to_corner(DL)
        self.play(Write(relativity))
        self.wait(1)

        # 时间膨胀：静止时钟 vs 运动时钟
        clock_label = MathTex(
            rf"\\Delta t' = \\gamma \\Delta t = {gamma:.2f} \\Delta t",
            font_size=30, color=PURPLE
        ).to_corner(DR)
        self.play(Write(clock_label))
        self.wait(2)`,
  },

  // ─── 8. Conway's Game of Life ───
  {
    title: "康威生命游戏——元胞自动机的涌现复杂性",
    description: "在网格上实现Conway生命游戏，展示简单规则如何产生滑翔机、振荡器和复杂的涌现行为",
    tags: ["元胞自动机", "涌现", "模拟", "网格", "计算"],
    code: `from manim import *
import numpy as np

class ConwaysGameOfLife(Scene):
    def construct(self):
        title = MathTex(
            r"\\text{Conway 生命游戏：简单规则的复杂涌现}",
            font_size=36, color=YELLOW
        ).to_edge(UP)
        self.play(Write(title))

        # 规则说明
        rules = VGroup(
            MathTex(r"\\text{活细胞：2-3个邻居}\\rightarrow\\text{存活}", font_size=24, color=GREEN),
            MathTex(r"\\text{死细胞：3个邻居}\\rightarrow\\text{诞生}", font_size=24, color=BLUE),
            MathTex(r"\\text{其他情况}\\rightarrow\\text{死亡}", font_size=24, color=RED),
        ).arrange(DOWN, aligned_edge=LEFT).to_corner(UL)
        self.play(Write(rules))

        # 网格参数
        n_rows, n_cols = 26, 36
        cell_size = 0.22
        grid_origin = LEFT * 3.6 + DOWN * 1.8

        # 初始图案：包含滑翔机、振荡器等经典结构
        grid = np.zeros((n_rows, n_cols), dtype=int)

        # Glider（滑翔机）
        glider = [(2, 3), (3, 4), (4, 2), (4, 3), (4, 4)]
        for r, c in glider:
            grid[r + 2, c + 2] = 1

        # Blinker（振荡器）
        blinker = [(12, 10), (12, 11), (12, 12)]
        for r, c in blinker:
            grid[r, c] = 1

        # Glider gun 简化版（产生滑翔机）
        gun_cells = [
            (1, 25), (1, 26), (2, 25), (2, 26),
            (11, 25), (11, 26), (11, 27),
            (12, 24), (12, 28),
            (13, 23), (13, 29),
            (14, 23), (14, 29),
            (15, 26),
            (16, 24), (16, 28),
            (17, 25), (17, 26), (17, 27),
            (18, 26),
        ]
        for r, c in gun_cells:
            grid[r, c] = 1

        # Gosper glider gun 第二部分
        grid[21, 25] = grid[21, 26] = grid[22, 25] = grid[22, 26] = 1

        # 创建网格单元格
        cells = VGroup()
        for r in range(n_rows):
            for c in range(n_cols):
                cell = Square(
                    side_length=cell_size,
                    color=GRAY, fill_opacity=0.1, stroke_width=0.5,
                )
                cell.move_to(grid_origin + RIGHT * c * cell_size + DOWN * r * cell_size)
                cells.add(cell)

        self.play(FadeIn(cells), run_time=1)

        # 更新活细胞显示
        def update_cells(g):
            colors = []
            for r in range(n_rows):
                for c in range(n_cols):
                    if g[r, c] == 1:
                        colors.append(YELLOW if np.sum(g[r, c]) else GREEN)
            return colors

        def step(g):
            new_g = g.copy()
            for r in range(n_rows):
                for c in range(n_cols):
                    neighbors = g[
                        max(0, r-1):min(n_rows, r+2),
                        max(0, c-1):min(n_cols, c+2)
                    ].sum() - g[r, c]
                    if g[r, c] == 1:
                        new_g[r, c] = 1 if 2 <= neighbors <= 3 else 0
                    else:
                        new_g[r, c] = 1 if neighbors == 3 else 0
            return new_g

        # 动画：逐代演化
        generation_counter = MathTex(r"\\text{第 }0\\text{ 代}", font_size=24).to_corner(DR)
        self.play(Write(generation_counter))

        for gen in range(15):
            # 更新显示
            animations = []
            for r in range(n_rows):
                for c in range(n_cols):
                    idx = r * n_cols + c
                    if grid[r, c] == 1:
                        animations.append(
                            cells[idx].animate.set_fill(YELLOW, opacity=0.8)
                        )
                    else:
                        animations.append(
                            cells[idx].animate.set_fill(GRAY, opacity=0.1)
                        )

            new_counter = MathTex(rf"\\text{{第 }}{gen+1}\\text{{ 代}}", font_size=24).to_corner(DR)
            animations.append(Transform(generation_counter, new_counter))

            self.play(*animations, run_time=0.4)

            grid = step(grid)

        # 滑翔机移动标注
        glider_label = MathTex(
            r"\\text{滑翔机持续移动！}", font_size=28, color=BLUE
        ).to_edge(DOWN)
        self.play(Write(glider_label))
        self.wait(2)`,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log("[seed-advanced] Checking Ollama...");
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp) {
    console.error("[seed-advanced] Ollama is not running. Start it with: ollama serve");
    process.exit(1);
  }

  const force = process.argv.includes("--force");

  console.log(`[seed-advanced] Inserting ${ADVANCED_EXAMPLES.length} advanced examples...`);
  let inserted = 0;

  for (const ex of ADVANCED_EXAMPLES) {
    const id = await insertExample({
      title: ex.title,
      description: ex.description,
      code: ex.code,
      tags: ex.tags,
      difficulty: 3,
      source: "ai-generated",
    });

    if (id) {
      inserted++;
      console.log(`[seed-advanced] ✓ ${ex.title}`);
    } else {
      console.log(`[seed-advanced] ✗ FAILED: ${ex.title}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n[seed-advanced] Done. Inserted ${inserted}/${ADVANCED_EXAMPLES.length} advanced examples.`);
}

main().catch((err) => {
  console.error("[seed-advanced] Fatal:", err);
  process.exit(1);
});
