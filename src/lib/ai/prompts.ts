/**
 * Few-shot prompt templates for Manim code generation.
 *
 * The SYSTEM_PROMPT gives the model its identity and constraints.
 * FEW_SHOT_EXAMPLES provide high-quality Manim code examples.
 */

export const SYSTEM_PROMPT = `你是 Mathiverse 的 Manim 动画专家助手。你的任务是根据用户的自然语言描述，生成高质量的 Manim Community v0.19 Python 代码。

## 两种工作模式

### 模式 1: 创建新代码
当用户要求创建新的可视化，或当前没有代码时：
- 从头生成完整的 Manim 场景
- 输出完整的可运行 Python 代码

### 模式 2: 修改现有代码
当用户要求修改、改进、或调试现有代码时（会附带"当前代码"）：
- 基于现有代码进行修改
- 保持代码结构和风格一致
- 只修改用户要求的部分，不要重写整个场景
- 输出完整的修改后代码（包含所有 import）

## 规则
1. 只输出有效的 Python 代码，不要输出额外的解释文字或 Markdown 标记。
2. 代码必须能直接用 Manim Community v0.19 渲染运行。
3. 使用中文注释解释关键步骤。
4. 优先使用以下 Manim 对象：MathTex, Tex, Axes, NumberPlane, VGroup, always_redraw, ValueTracker
5. 动画要流畅美观，使用合适的颜色和时长。
6. 场景类名使用有意义的英文名。
7. 代码结构清晰，适当拆分方法。
8. 如果用户的描述不清晰，生成一个合理的默认可视化。

## 常用的 Manim 模式
- 坐标系可视化：使用 Axes + plot + always_redraw
- 几何图形：使用 Circle, Square, Polygon, Dot + Transform/animate
- 公式展示：使用 MathTex + Write/Transform
- 3D 场景：继承 ThreeDScene，使用 set_camera_orientation
- 参数动画：使用 ValueTracker + always_redraw

## 示例输出格式
\`\`\`python
from manim import *

class SceneName(Scene):
    def construct(self):
        # 你的代码
        pass
\`\`\``;

/**
 * Build the system prompt with current code context injected.
 * When there's existing code, the AI is instructed to modify it rather than start fresh.
 */
export function buildSystemPrompt(currentCode?: string): string {
  if (currentCode && currentCode.trim().length > 0) {
    return `${SYSTEM_PROMPT}

## 当前代码
以下是用户正在编辑的代码。如果用户要求修改，请基于此代码进行修改并输出完整代码：

\`\`\`python
${currentCode}
\`\`\``;
  }
  return SYSTEM_PROMPT;
}

export const FEW_SHOT_EXAMPLES = [
  {
    role: "user" as const,
    content: "可视化傅里叶级数逼近方波的过程",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class FourierSquareWave(Scene):
    def construct(self):
        # 创建坐标系
        axes = Axes(
            x_range=[-3.3, 3.3, 1],
            y_range=[-2, 2, 1],
            x_length=7,
            y_length=4,
        )
        labels = axes.get_axis_labels(x_label="t", y_label="f(t)")
        self.play(Create(axes), Write(labels))

        # 目标方波
        square_wave = axes.plot(
            lambda x: 1 if np.sin(x) >= 0 else -1,
            color=YELLOW,
            stroke_width=2,
        )
        square_label = MathTex(r"\text{方波}", font_size=28).next_to(square_wave, UP)

        # 逐步叠加谐波
        terms_label = MathTex(r"n = 1", font_size=32).to_corner(UR)
        self.play(Write(terms_label))

        wave_graph = always_redraw(lambda: axes.plot(
            lambda x: sum(
                (4 / (k * PI)) * np.sin(k * x)
                for k in range(1, terms_count + 1, 2)
            ),
            color=BLUE,
            stroke_width=3,
        ))

        terms_count = 1
        self.play(Create(wave_graph))

        for n in [3, 5, 7, 9, 11, 13, 15]:
            terms_count = n
            new_label = MathTex(
                r"n = " + str(n), font_size=32
            ).to_corner(UR)
            self.play(Transform(terms_label, new_label), run_time=0.8)
            self.wait(0.3)

        self.play(Create(square_wave), Write(square_label))
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "展示复平面上 e^(ix) 的轨迹，解释欧拉公式",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class EulerFormula(Scene):
    def construct(self):
        # 创建复平面
        plane = ComplexPlane(
            x_range=[-2.5, 2.5, 1],
            y_range=[-2.5, 2.5, 1],
            x_length=7,
            y_length=7,
            background_line_style={
                "stroke_color": TEAL,
                "stroke_width": 1,
                "stroke_opacity": 0.4,
            },
        )
        self.play(Create(plane))

        # 标题
        title = MathTex(
            r"e^{i\theta} = \cos\theta + i\sin\theta",
            font_size=42,
            color=YELLOW,
        ).to_edge(UP)
        self.play(Write(title))

        # 单位圆
        circle = Circle(radius=2, color=BLUE, stroke_width=2)
        circle.move_to(plane.c2p(0, 0))
        self.play(Create(circle))

        # 轨迹点
        tracer = TracedPath(
            lambda: dot.get_center(),
            stroke_color=YELLOW,
            stroke_width=3,
        )
        self.add(tracer)

        dot = Dot(color=RED, radius=0.08)
        dot.move_to(plane.c2p(1, 0))

        # 角度指示器
        theta_tracker = ValueTracker(0)
        theta_label = always_redraw(lambda: MathTex(
            r"\theta = " + f"{theta_tracker.get_value():.1f}",
            font_size=28,
        ).to_corner(UR))

        self.add(theta_label)
        self.play(
            MoveAlongPath(dot, circle, rate_func=linear),
            theta_tracker.animate.set_value(2 * PI),
            run_time=8,
        )

        # 显示 e^(iπ) + 1 = 0
        final = MathTex(
            r"e^{i\pi} + 1 = 0",
            font_size=48,
            color=GREEN,
        ).to_edge(DOWN)
        self.play(Write(final))
        self.wait(3)`,
  },
  {
    role: "user" as const,
    content: "让切线沿曲线 f(x)=1/2x² 滑动，实时显示各点的导数（切线斜率）",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class TangentSliding(Scene):
    def construct(self):
        # 标题：函数与导函数
        formula = MathTex(
            r"f(x) = \\frac{1}{2}x^2, \\quad f'(x) = x",
            font_size=36,
            color=YELLOW,
        ).to_edge(UP)
        self.play(Write(formula))

        # 坐标系与函数曲线
        axes = Axes(
            x_range=[-3.2, 3.2, 1],
            y_range=[-1, 6, 1],
            x_length=8,
            y_length=5,
            axis_config={"include_numbers": True},
        ).shift(DOWN * 0.4)
        curve = axes.plot(lambda x: 0.5 * x**2, color=BLUE, stroke_width=3)
        self.play(Create(axes), Create(curve))

        # 用 ValueTracker 控制切点横坐标
        x_tracker = ValueTracker(-2.5)

        def get_tangent():
            # 根据当前位置计算切点与切线
            x0 = x_tracker.get_value()
            y0 = 0.5 * x0**2
            return Line(
                axes.c2p(x0 - 1.5, y0 - x0 * 1.5),
                axes.c2p(x0 + 1.5, y0 + x0 * 1.5),
                color=RED,
                stroke_width=3,
            )

        # 切点、切线与斜率标签（always_redraw 实时更新）
        dot = always_redraw(lambda: Dot(
            axes.c2p(x_tracker.get_value(), 0.5 * x_tracker.get_value()**2),
            color=RED,
            radius=0.09,
        ))
        tangent = always_redraw(get_tangent)
        guide = always_redraw(lambda: DashedLine(
            axes.c2p(x_tracker.get_value(), 0),
            axes.c2p(x_tracker.get_value(), 0.5 * x_tracker.get_value()**2),
            color=GRAY,
            stroke_width=1.5,
        ))
        slope_label = always_redraw(lambda: MathTex(
            rf"f'({x_tracker.get_value():.2f}) = {x_tracker.get_value():.2f}",
            font_size=32,
            color=RED,
        ).to_corner(UR))
        self.add(guide, dot, tangent, slope_label)
        self.wait(0.5)

        # 切点沿曲线来回滑动，直观展示导数（斜率）的变化
        self.play(
            x_tracker.animate.set_value(2.5),
            run_time=8,
            rate_func=there_and_back,
        )
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "可视化线性变换 A=[[2,1],[1,2]] 对网格的作用，突出特征向量方向不变的性质",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class EigenvectorTransform(Scene):
    def construct(self):
        # 标题：展示变换矩阵
        title = MathTex(
            r"A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}",
            font_size=44,
            color=YELLOW,
        ).to_edge(UP)
        self.play(Write(title))

        # 网格平面
        plane = NumberPlane(
            x_range=[-4, 4, 1],
            y_range=[-4, 4, 1],
            x_length=6.5,
            y_length=6.5,
            background_line_style={"stroke_opacity": 0.45},
        ).shift(DOWN * 0.6)
        self.play(Create(plane))

        # 两条特征向量方向（v1=(1,1)，v2=(1,-1)）
        v1 = Arrow(ORIGIN, 3 * RIGHT + 3 * UP, buff=0, color=BLUE, stroke_width=6).shift(DOWN * 0.6)
        v2 = Arrow(ORIGIN, 3 * RIGHT - 3 * UP, buff=0, color=GREEN, stroke_width=6).shift(DOWN * 0.6)
        self.play(GrowArrow(v1), GrowArrow(v2))

        # 特征值与特征向量说明
        info = MathTex(
            r"v_1=(1,1),\\ \\lambda_1=3; \\quad v_2=(1,-1),\\ \\lambda_2=1",
            font_size=28,
        ).to_corner(DL)
        self.play(Write(info))

        # 施加线性变换：网格被拉伸，特征向量方向不变
        M = np.array([[2, 1], [1, 2]])
        self.play(ApplyMatrix(M, plane), run_time=3)
        self.play(ApplyMatrix(M, v1), ApplyMatrix(M, v2), run_time=2)

        hint = MathTex(
            r"\\text{特征向量方向不变！}",
            font_size=38,
            color=RED,
        ).to_corner(UR)
        self.play(Write(hint))
        self.wait(2)

        # 逆变换还原
        self.play(
            ApplyMatrix(np.linalg.inv(M), plane),
            ApplyMatrix(np.linalg.inv(M), v1),
            ApplyMatrix(np.linalg.inv(M), v2),
            run_time=2,
        )
        self.wait(1)`,
  },
  {
    role: "user" as const,
    content: "模拟掷硬币 500 次，展示正面频率随投掷次数增加逐渐收敛到 0.5（大数定律）",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class LawOfLargeNumbers(Scene):
    def construct(self):
        # 预先模拟 500 次抛硬币（固定随机种子，保证可复现）
        rng = np.random.default_rng(42)
        flips = rng.integers(0, 2, size=500)
        cumulative = np.cumsum(flips)
        proportions = cumulative / np.arange(1, len(flips) + 1)

        # 标题
        title = MathTex(
            r"\\text{大数定律：频率收敛于概率}",
            font_size=38,
            color=YELLOW,
        ).to_edge(UP)
        self.play(Write(title))

        # 坐标系
        axes = Axes(
            x_range=[0, 500, 100],
            y_range=[0, 1, 0.25],
            x_length=9.5,
            y_length=4.5,
            axis_config={"include_numbers": True},
        ).shift(DOWN * 0.4)
        labels = axes.get_axis_labels(x_label="n", y_label="p")
        self.play(Create(axes), Write(labels))

        # 理论概率 0.5 的参考线
        ref_line = axes.plot(lambda x: 0.5, color=GREEN, stroke_width=2)
        ref_label = MathTex(r"0.5", font_size=26, color=GREEN).next_to(ref_line, LEFT, buff=0.15)
        self.play(Create(ref_line), Write(ref_label))

        # 用 ValueTracker 控制投掷次数
        n_tracker = ValueTracker(5)

        def current_proportion():
            # 当前投掷次数对应的累计频率
            idx = min(int(n_tracker.get_value()), len(proportions)) - 1
            return proportions[max(idx, 0)]

        # 实时更新的频率点与轨迹
        freq_dot = always_redraw(lambda: Dot(
            axes.c2p(n_tracker.get_value(), current_proportion()),
            color=RED,
            radius=0.07,
        ))
        trail = TracedPath(
            freq_dot.get_center,
            stroke_color=RED,
            stroke_width=2.5,
            stroke_opacity=0.6,
        )
        value_label = always_redraw(lambda: MathTex(
            rf"n = {int(n_tracker.get_value())}, \\quad p = {current_proportion():.4f}",
            font_size=30,
            color=RED,
        ).to_corner(UR))
        self.add(trail, freq_dot, value_label)
        self.wait(0.5)

        # 动画：频率逐渐收敛到 0.5
        self.play(
            n_tracker.animate.set_value(500),
            run_time=9,
            rate_func=linear,
        )
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "用几何动画证明勾股定理：在直角三角形三条边上构造正方形，展示 a²+b²=c²",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class PythagoreanTheorem(Scene):
    def construct(self):
        # 标题
        title = MathTex(r"\\text{勾股定理}", font_size=44, color=YELLOW).to_edge(UP)
        self.play(Write(title))

        # 直角三角形（3-4-5，缩放 0.5 以适配画面）
        s = 0.5
        A = np.array([0, 0, 0])
        B = np.array([4 * s, 0, 0])
        C = np.array([0, 3 * s, 0])

        triangle = Polygon(A, B, C, color=WHITE, fill_opacity=0.35, stroke_width=2)
        # 三条边上的正方形：a（下）、b（左）、c（斜边）
        sq_a = Polygon(A, B, [4 * s, -4 * s, 0], [0, -4 * s, 0], color=BLUE, fill_opacity=0.25, stroke_width=2)
        sq_b = Polygon(A, C, [-3 * s, 3 * s, 0], [-3 * s, 0, 0], color=GREEN, fill_opacity=0.25, stroke_width=2)
        sq_c = Polygon(B, C, [3 * s, 7 * s, 0], [7 * s, 4 * s, 0], color=RED, fill_opacity=0.25, stroke_width=2)

        figures = VGroup(triangle, sq_a, sq_b, sq_c).move_to(DOWN * 0.6 + LEFT * 1.0)
        self.play(Create(figures), run_time=2)

        # 面积标签
        area_a = MathTex(r"a^2", color=BLUE, font_size=36).move_to(sq_a.get_center())
        area_b = MathTex(r"b^2", color=GREEN, font_size=36).move_to(sq_b.get_center())
        area_c = MathTex(r"c^2", color=RED, font_size=36).move_to(sq_c.get_center())
        self.play(Write(area_a), Write(area_b), Write(area_c))
        self.wait(0.5)

        # 结论公式
        conclusion = MathTex(r"a^2 + b^2 = c^2", font_size=46, color=WHITE).to_edge(DOWN)
        self.play(Write(conclusion))

        # 代入 3-4-5 的具体数值
        numeric = MathTex(r"3^2 + 4^2 = 5^2", font_size=36, color=YELLOW)
        numeric.next_to(conclusion, UP, buff=0.35)
        self.play(Write(numeric))
        self.wait(1)

        # 强调：两直角边正方形面积之和等于斜边正方形面积
        self.play(
            Indicate(area_a),
            Indicate(area_b),
            Indicate(conclusion),
            run_time=1.5,
        )
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "模拟斜抛运动，画出轨迹并实时分解显示水平与竖直方向的速度矢量",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class ProjectileMotion(Scene):
    def construct(self):
        # 物理参数：初速度、抛射角、重力加速度
        v0, theta, g = 8.0, 60 * DEGREES, 9.8
        T = 2 * v0 * np.sin(theta) / g  # 飞行总时间

        def x_pos(t):  # 水平位移
            return v0 * np.cos(theta) * t

        def y_pos(t):  # 竖直位移
            return v0 * np.sin(theta) * t - 0.5 * g * t**2

        def vx(t):  # 水平分速度（恒定）
            return v0 * np.cos(theta)

        def vy(t):  # 竖直分速度（随时间变化）
            return v0 * np.sin(theta) - g * t

        # 标题
        title = MathTex(r"\\text{斜抛运动：速度的分解}", font_size=40, color=YELLOW).to_edge(UP)
        self.play(Write(title))

        # 坐标系与抛物线轨迹
        axes = Axes(
            x_range=[0, 7, 1], y_range=[0, 3.5, 1],
            x_length=9, y_length=4.5,
            axis_config={"include_numbers": True},
        ).shift(DOWN * 0.3)
        trajectory = axes.plot_parametric_curve(
            lambda t: np.array([x_pos(t), y_pos(t), 0]),
            t_range=[0, T], color=BLUE, stroke_width=3,
        )
        self.play(Create(axes), Create(trajectory), run_time=2)

        # 用 ValueTracker 控制运动时间
        t_tracker = ValueTracker(0.02)
        vel_scale = 0.14  # 速度单位 -> 画面单位

        def v_vec(x, y):  # 把速度分量转换为画面坐标向量
            return axes.c2p(x * vel_scale, y * vel_scale) - axes.c2p(0, 0)

        # 小球（实时更新位置）
        dot = always_redraw(lambda: Dot(
            axes.c2p(x_pos(t_tracker.get_value()), y_pos(t_tracker.get_value())),
            color=WHITE,
            radius=0.08,
        ))
        # 合速度（红）与水平/竖直分量（蓝/绿）
        v_total = always_redraw(lambda: Arrow(
            dot.get_center(), dot.get_center() + v_vec(vx(t_tracker.get_value()), vy(t_tracker.get_value())),
            buff=0, color=RED, stroke_width=5,
        ))
        vx_arrow = always_redraw(lambda: Arrow(
            dot.get_center(), dot.get_center() + v_vec(vx(t_tracker.get_value()), 0),
            buff=0, color=BLUE, stroke_width=4,
        ))
        vy_arrow = always_redraw(lambda: Arrow(
            dot.get_center() + v_vec(vx(t_tracker.get_value()), 0),
            dot.get_center() + v_vec(vx(t_tracker.get_value()), vy(t_tracker.get_value())),
            buff=0, color=GREEN, stroke_width=4,
        ))
        self.add(dot, vx_arrow, vy_arrow, v_total)

        # 图例
        legend = VGroup(
            MathTex(r"\\text{合速度 } v", color=RED, font_size=28),
            MathTex(r"v_x \\text{（水平分量）}", color=BLUE, font_size=28),
            MathTex(r"v_y \\text{（竖直分量）}", color=GREEN, font_size=28),
        ).arrange(DOWN, aligned_edge=LEFT).to_corner(UL)
        self.play(Write(legend))

        # 小球沿轨迹运动，速度矢量不断变化
        self.play(t_tracker.animate.set_value(T), run_time=8, rate_func=linear)
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "用柱状图可视化冒泡排序的比较与交换过程",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class BubbleSortVisualization(Scene):
    def construct(self):
        # 生成 12 个随机高度的柱子（固定随机种子，结果可复现）
        rng = np.random.default_rng(7)
        data = list(rng.integers(1, 10, size=12))

        title = MathTex(r"\\text{冒泡排序}", font_size=40, color=YELLOW).to_edge(UP)
        self.play(Write(title))

        # 创建柱子并摆放到底部基准线上
        bars = VGroup(*[
            Rectangle(
                width=0.42, height=v * 0.35,
                fill_color=BLUE, fill_opacity=0.8,
                stroke_width=1.5,
            )
            for v in data
        ])
        bars.arrange(RIGHT, buff=0.1).align_to(ORIGIN, DOWN).shift(DOWN * 1.3)
        base = Line(LEFT * 3.6 + DOWN * 1.3, RIGHT * 3.6 + DOWN * 1.3, color=GRAY, stroke_width=2)
        self.play(FadeIn(bars), Create(base), run_time=1)

        # 比较次数计数器
        step_label = MathTex(r"\\text{步数} = 0", font_size=28).to_corner(UR)
        self.play(Write(step_label))

        def swap(i, j):
            # 交换两根柱子的位置
            pos_i, pos_j = bars[i].get_center(), bars[j].get_center()
            bars[i], bars[j] = bars[j], bars[i]
            self.play(
                bars[i].animate.move_to(pos_i),
                bars[j].animate.move_to(pos_j),
                run_time=0.25,
            )

        # 冒泡排序主循环
        n, step = len(data), 0
        for i in range(n - 1):
            for j in range(n - 1 - i):
                # 高亮正在比较的两个元素
                step += 1
                self.play(
                    bars[j].animate.set_color(YELLOW),
                    bars[j + 1].animate.set_color(RED),
                    run_time=0.1,
                )
                if data[j] > data[j + 1]:
                    data[j], data[j + 1] = data[j + 1], data[j]
                    swap(j, j + 1)
                # 恢复颜色并更新计数器
                self.play(
                    bars[j].animate.set_color(BLUE),
                    bars[j + 1].animate.set_color(BLUE),
                    Transform(step_label, MathTex(rf"\\text{步数} = {step}", font_size=28).to_corner(UR)),
                    run_time=0.08,
                )
            # 本轮结束，最大元素已就位
            self.play(bars[n - 1 - i].animate.set_color(GREEN), run_time=0.3)

        # 全部就位
        self.play(bars[0].animate.set_color(GREEN), run_time=0.3)
        done = MathTex(r"\\text{排序完成！}", font_size=36, color=GREEN).to_corner(DL)
        self.play(Write(done))
        self.wait(2)`,
  },
  {
    role: "user" as const,
    content: "在三维空间中展示一个按颜色渐变着色的环形曲面（环面）并旋转",
  },
  {
    role: "assistant" as const,
    content: `from manim import *
import numpy as np

class RotatingTorus(ThreeDScene):
    def construct(self):
        # 设置 3D 相机视角
        self.set_camera_orientation(phi=70 * DEGREES, theta=-40 * DEGREES)

        # 标题固定在屏幕上，不随相机旋转
        title = MathTex(r"\\text{三维环形曲面（环面）}", font_size=40, color=YELLOW).to_edge(UP)
        self.add_fixed_in_frame_mobjects(title)

        # 三维坐标轴
        axes = ThreeDAxes(
            x_range=[-3.5, 3.5, 1],
            y_range=[-3.5, 3.5, 1],
            z_range=[-1.5, 1.5, 0.5],
            x_length=7, y_length=7, z_length=3,
            axis_config={"stroke_opacity": 0.5},
        )
        self.play(Create(axes))

        # 参数化环面：主半径 R=2，管半径 r=0.7
        def torus(u, v):
            R, r = 2.0, 0.7
            return np.array([
                (R + r * np.cos(v)) * np.cos(u),
                (R + r * np.cos(v)) * np.sin(u),
                r * np.sin(v),
            ])

        surface = Surface(
            torus,
            u_range=[0, TAU],
            v_range=[0, TAU],
            resolution=(48, 32),
            fill_opacity=0.75,
        )
        # 用渐变色为曲面着色
        surface.set_color_by_gradient(BLUE, PURPLE, RED)
        self.play(Create(surface), run_time=3)

        # 匀速旋转，全方位展示
        self.begin_ambient_camera_rotation(rate=0.4)
        self.wait(6)
        self.stop_ambient_camera_rotation()
        self.wait(1)`,
  },
];

/**
 * Build the full message array for a chat completion request.
 * @param history Previous user/assistant messages
 * @param userMessage The latest user message
 * @param currentCode Optional current editor code for context-aware generation
 */
export function buildMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  currentCode?: string,
) {
  const systemContent = buildSystemPrompt(currentCode);

  return [
    { role: "system" as const, content: systemContent },
    ...FEW_SHOT_EXAMPLES,
    ...history,
    { role: "user" as const, content: userMessage },
  ];
}

/**
 * Extract Python code from an AI response that may contain markdown code fences.
 */
export function extractCode(content: string): string {
  // Try ```python ... ``` first
  const fenceMatch = content.match(
    /```(?:python|py)?\s*\n?([\s\S]*?)```/,
  );
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // If the content starts with "from manim" or "import manim", it's raw code
  if (
    content.trim().startsWith("from manim") ||
    content.trim().startsWith("import manim")
  ) {
    return content.trim();
  }

  // Fallback: return as-is
  return content.trim();
}

/* ─── AI Metadata Generation ─── */

const METADATA_SYSTEM_PROMPT = `你是一个内容策展助手。根据用户与 AI 的对话和最终的 Manim 代码，为这个数学可视化作品生成元数据。

## 要求
1. title: 简洁的中文标题（10-20 字），准确描述可视化内容
2. description: 中文描述（30-80 字），说明这个可视化展示的数学概念和观看价值
3. tags: 3-5 个中文标签，从代码内容和对话中提取关键数学概念

## 输出格式
只输出 JSON，不要有任何额外文字：
{"title": "...", "description": "...", "tags": ["...", "..."]}`;

/**
 * Generate title, description, and tags for a visualization using AI.
 * Uses a non-streaming call to keep it fast and simple.
 */
export async function generateMetadata(
  userPrompt: string,
  code: string,
): Promise<{ title: string; description: string; tags: string[] }> {
  const { chatCompletion, isConfigured } = await import("./client");

  if (!isConfigured()) {
    // Fallback: extract a basic title from the code class name
    const classMatch = code.match(/class\s+(\w+)\s*\(/);
    const className = classMatch?.[1] ?? "未命名可视化";
    return {
      title: className,
      description: `${userPrompt.slice(0, 80)}`,
      tags: ["数学", "可视化"],
    };
  }

  try {
    const response = await chatCompletion({
      messages: [
        { role: "system", content: METADATA_SYSTEM_PROMPT },
        {
          role: "user",
          content: `用户需求: ${userPrompt}\n\n代码:\n\`\`\`python\n${code.slice(0, 3000)}\n\`\`\``,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title ?? "未命名可视化",
        description: parsed.description ?? userPrompt.slice(0, 80),
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : ["数学", "可视化"],
      };
    }

    throw new Error("No JSON found in response");
  } catch {
    // Graceful fallback
    const classMatch = code.match(/class\s+(\w+)\s*\(/);
    const className = classMatch?.[1] ?? "未命名可视化";
    return {
      title: className,
      description: userPrompt.slice(0, 80),
      tags: ["数学", "可视化"],
    };
  }
}

/* ─── AI Error Fix ─── */

const FIX_SYSTEM_PROMPT = `你是 Manim 调试专家。用户渲染代码时遇到了错误。请分析错误信息并修复代码。

## 规则
1. 只输出修复后的完整 Python 代码
2. 在代码中用中文注释标注修改的位置（# 修复: ...）
3. 常见 Manim 错误：
   - "AttributeError" → 检查对象是否有该属性或方法
   - "TypeError" → 检查参数类型是否正确
   - "NameError" → 检查变量是否定义，或 import 是否遗漏
   - 坐标错误 → 检查 np.array 或 plane.c2p 的使用
   - 动画类型错误 → 确保传递给 play() 的是 Animation 对象

## 当前代码
\`\`\`python
{code}
\`\`\`

## 渲染错误
{error}

请输出修复后的完整代码。`;

/**
 * Build a prompt for AI error fixing.
 */
export function buildFixPrompt(code: string, error: string) {
  return FIX_SYSTEM_PROMPT.replace("{code}", code).replace("{error}", error);
}
