import type { VerifiedManimExample } from "./types";

export const VERIFIED_FALLBACK_EXAMPLES: readonly VerifiedManimExample[] = [
  {
    id: "fallback-axes-plot",
    title: "二维函数图像",
    description: "用坐标轴绘制一个简洁函数图像",
    code: `from manim import *

class VerifiedAxesPlot(Scene):
    def construct(self):
        axes = Axes(x_range=[-3, 3, 1], y_range=[-1, 9, 1])
        graph = axes.plot(lambda x: x ** 2, color=BLUE)
        self.play(Create(axes), Create(graph))`,
    tags: ["2d", "axes"],
    difficulty: 1,
    source: "built-in-verified",
    dimension: "2d",
    manimVersion: "0.20.1",
    renderVerified: true,
    renderHash: "builtin:axes-plot:0.20.1",
  },
  {
    id: "fallback-3d-surface",
    title: "三维曲面",
    description: "用 ThreeDAxes 展示一个基础参数曲面",
    code: `from manim import *

class VerifiedSurface(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        surface = Surface(
            lambda u, v: axes.c2p(u, v, 0.25 * (u ** 2 - v ** 2)),
            u_range=[-2, 2], v_range=[-2, 2], resolution=(12, 12),
        )
        self.set_camera_orientation(phi=65 * DEGREES, theta=-45 * DEGREES)
        self.play(Create(axes), Create(surface))`,
    tags: ["3d", "surface"],
    difficulty: 2,
    source: "built-in-verified",
    dimension: "3d",
    manimVersion: "0.20.1",
    renderVerified: true,
    renderHash: "builtin:surface:0.20.1",
  },
];
