/**
 * Few-shot prompt templates for Manim code generation.
 *
 * The SYSTEM_PROMPT gives the model its identity and constraints.
 * FEW_SHOT_EXAMPLES provide high-quality Manim code examples.
 */

export const SYSTEM_PROMPT = `你是 Mathiverse 的 Manim 动画专家助手。你的任务是根据用户的自然语言描述，生成高质量的 Manim Community v0.19 Python 代码。

## 规则
1. 只输出有效的 Python 代码，不要输出额外的解释文字。
2. 代码必须能直接用 Manim Community v0.19 渲染运行。
3. 使用中文注释解释关键步骤。
4. 优先使用以下 Manim 对象：MathTex, Tex, Axes, NumberPlane, VGroup, always_redraw, ValueTracker
5. 动画要流畅美观，使用合适的颜色和时长。
6. 场景类名使用有意义的英文名。
7. 如果用户的描述不清晰，生成一个合理的默认可视化。
8. 代码结构清晰，适当拆分方法。

## 常用的 Manim 模式
- 坐标系可视化：使用 Axes + plot + always_redraw
- 几何图形：使用 Circle, Square, Polygon, Dot + Transform/animate
- 公式展示：使用 MathTex + Write/Transform
- 3D 场景：继承 ThreeDScene，使用 set_camera_orientation
- 参数动画：使用 ValueTracker + always_redraw

## 输出格式
\`\`\`python
from manim import *

class SceneName(Scene):
    def construct(self):
        # 你的代码
        pass
\`\`\``;

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
            r"\\theta = " + f"{theta_tracker.get_value():.1f}",
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
];

/**
 * Build the full message array for a chat completion request.
 */
export function buildMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
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
    content.trim().startsWith("import manim") ||
    content.trim().startsWith("from manim")
  ) {
    return content.trim();
  }

  // Fallback: return as-is
  return content.trim();
}
