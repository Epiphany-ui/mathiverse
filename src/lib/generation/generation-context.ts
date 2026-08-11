// Build de-duplicated model context for Manim code generation.
// Guarantees:
// 1. Placeholder/default code is never included as editing context (mode "new").
// 2. The current code appears exactly once in the model context (edit/repair).
// 3. The ScenePlan is always serialized as a system-level instruction.
// 4. No historical assistant code is appended — only system + user messages.

import type { AIMessage } from "@/lib/ai/client";
import type { ManimExample, VerifiedManimExample } from "@/lib/ai/types";
import type { ScenePlan } from "./types";

const MAX_EXAMPLES = 3;

function serializePlan(plan: ScenePlan): string {
  return JSON.stringify(plan, null, 2);
}

function isTrustedExample(example: ManimExample): example is VerifiedManimExample {
  const candidate = example as Partial<VerifiedManimExample>;
  return candidate.renderVerified === true && Boolean(candidate.renderHash);
}

function serializeExamples(examples: ManimExample[]): string {
  if (examples.length === 0) return "";
  const blocks = examples.filter(isTrustedExample).slice(0, MAX_EXAMPLES).map((example, index) => {
    const meta = [
      `标题: ${example.title}`,
      `描述: ${example.description}`,
      `标签: ${example.tags.join(", ")}`,
      `难度: ${example.difficulty}`,
    ].join("\n");
    return `示例 ${index + 1}:\n${meta}\n\`\`\`python\n${example.code}\n\`\`\``;
  });
  return blocks.join("\n\n");
}

function buildSystemContent(plan: ScenePlan, examples: ManimExample[]): string {
  const parts = [
    "你是 Manim 代码生成引擎。必须严格遵循以下场景计划，只输出可直接渲染的 Python 代码，不要输出解释文字或 Markdown。",
    `## 场景计划\n${serializePlan(plan)}`,
  ];
  const exampleBlock = serializeExamples(examples);
  if (exampleBlock) {
    parts.push(
      `## 参考示例（仅作风格与 API 参考，不要照抄类名）\n${exampleBlock}`,
    );
  }
  return parts.join("\n\n");
}

function buildEditContext(currentCode: string): string {
  return `以下是当前代码，请基于它进行修改，输出完整代码：\n\`\`\`python\n${currentCode}\n\`\`\``;
}

export function buildGenerationMessages(input: {
  prompt: string;
  mode: "new" | "edit" | "repair";
  currentCode: string | null;
  plan: ScenePlan;
  examples: ManimExample[];
}): AIMessage[] {
  const { prompt, mode, currentCode, plan, examples } = input;

  const messages: AIMessage[] = [
    { role: "system", content: buildSystemContent(plan, examples) },
  ];

  if (mode !== "new" && currentCode && currentCode.trim().length > 0) {
    messages.push({ role: "user", content: buildEditContext(currentCode) });
  }

  messages.push({ role: "user", content: prompt });
  return messages;
}

export function filterRetrievedExamples(
  rows: (ManimExample & {
    similarity: number;
    dimension?: string;
    manimVersion?: string;
    renderVerified?: boolean;
    renderHash?: string | null;
  })[],
  options: {
    minSimilarity: number;
    dimension?: string;
    manimVersion?: string;
    maxDifficulty?: number;
  },
): VerifiedManimExample[] {
  return rows
    .filter((row) => row.similarity >= options.minSimilarity)
    .filter((row) =>
      options.dimension ? row.dimension === options.dimension : true,
    )
    .filter((row) =>
      options.manimVersion ? row.manimVersion === options.manimVersion : true,
    )
    .filter((row) =>
      options.maxDifficulty !== undefined
        ? row.difficulty <= options.maxDifficulty
        : true,
    )
    .filter((row) => row.renderVerified === true && Boolean(row.renderHash))
    .map(({ id, title, description, code, tags, difficulty, source, similarity, dimension, manimVersion, renderHash }) => ({
      id,
      title,
      description,
      code,
      tags,
      difficulty,
      source,
      similarity,
      dimension: dimension as VerifiedManimExample["dimension"],
      manimVersion: manimVersion ?? "",
      renderVerified: true,
      renderHash: renderHash ?? null,
    }));
}
