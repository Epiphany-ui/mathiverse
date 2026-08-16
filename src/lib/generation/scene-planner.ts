import type { ScenePlan } from "./types";
import { chatCompletion, MODELS, type AIMessage } from "@/lib/ai/client";

const PLANNER_PROMPT = `你是一个 Manim 动画场景规划器。根据用户的数学可视化需求，输出一个 JSON 格式的场景计划。

必须返回有效的 JSON，格式如下：
{
  "objects": ["Circle", "Axes", ...],
  "layout": "2d" | "3d" | "formula" | "mixed",
  "stages": [
    { "title": "阶段名称", "intent": "这个阶段做什么" }
  ],
  "trackers": ["ValueTracker", ...],
  "estimatedComplexity": "simple" | "standard" | "complex"
}

规则：
- objects: 列出场景中需要的所有 Manim 对象
- layout: 根据需求判断是二维、三维、公式还是混合场景
- stages: 3-5 个主要动画阶段，每个有标题和意图
- trackers: 需要持续更新的参数追踪器
- estimatedComplexity: simple（单个对象）| standard（多个交互）| complex（三维、多阶段或复杂变换）
- 只返回 JSON，不要有其他文字`;

function buildFallbackPlan(prompt: string, has3d: boolean): ScenePlan {
  return {
    objects: [prompt.slice(0, 80)],
    layout: has3d ? "3d" : "2d",
    stages: [
      { title: "建立场景", intent: "创建数学对象和布局" },
      { title: "演示关系", intent: "按用户描述播放核心动画" },
      { title: "收束画面", intent: "保留关键公式或结论" },
    ],
    trackers: [],
    estimatedComplexity: "standard",
  };
}

function extractFirstJsonObject(content: string): string | null {
  const start = content.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      /* legacy branch replaced below
      if (escaped) escaped = false;
      else if (character === "\") escaped = true;
      else if (character === '"') inString = false;
      continue;
      */
      if (escaped) escaped = false;
      else if (character.charCodeAt(0) === 92) escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return content.slice(start, index + 1);
  }
  return null;
}

/**
 * Generate a structured scene plan. Uses a fast model with no reasoning.
 * Falls back to a sensible default on parse failure.
 */
export async function planScene(
  prompt: string,
  currentCode: string | null,
  signal?: AbortSignal,
): Promise<ScenePlan> {
  const has3d = currentCode?.includes("ThreeDScene") ?? false;

  const messages: AIMessage[] = [
    { role: "system", content: PLANNER_PROMPT },
    { role: "user", content: prompt },
  ];

  try {
    const content = await chatCompletion({
      messages,
      model: MODELS.metadata,
      max_tokens: 900,
      temperature: 0.3,
      thinking: { type: "disabled" },
      signal,
    });

    // Extract the first JSON object from the response
    const jsonObject = extractFirstJsonObject(content);
    if (!jsonObject) return buildFallbackPlan(prompt, has3d);

    const parsed: unknown = JSON.parse(jsonObject);
    if (!parsed || typeof parsed !== "object") return buildFallbackPlan(prompt, has3d);
    const candidate = parsed as Record<string, unknown>;

    // Validate required fields
    if (
      !Array.isArray(candidate.objects) ||
      !["2d", "3d", "formula", "mixed"].includes(candidate.layout as string) ||
      !Array.isArray(candidate.stages) ||
      candidate.objects.some((value: unknown) => typeof value !== "string") ||
      candidate.stages.length === 0 ||
      candidate.stages.some((stage: unknown) => {
        if (!stage || typeof stage !== "object") return true;
        const value = stage as Record<string, unknown>;
        return typeof value.title !== "string" || typeof value.intent !== "string";
      }) ||
      !Array.isArray(candidate.trackers) ||
      candidate.trackers.some((value: unknown) => typeof value !== "string") ||
      !["simple", "standard", "complex"].includes(candidate.estimatedComplexity as string)
    ) {
      return buildFallbackPlan(prompt, has3d);
    }

    return {
      objects: candidate.objects,
      layout: candidate.layout as ScenePlan["layout"],
      stages: candidate.stages.map((s) => ({
        ...(s as { title: string; intent: string }),
      })).map((s) => ({
        title: String(s.title ?? ""),
        intent: String(s.intent ?? ""),
      })),
      trackers: candidate.trackers,
      estimatedComplexity: candidate.estimatedComplexity as ScenePlan["estimatedComplexity"],
    };
  } catch {
    return buildFallbackPlan(prompt, has3d);
  }
}
