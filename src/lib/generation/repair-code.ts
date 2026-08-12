// One-shot AI repair — exactly ONE model call per invocation.
// The repair model must return a COMPLETE runnable Manim Python module;
// the caller applies it and re-validates. Diffs are never requested.

import type { AIMessage } from "@/lib/ai/client";
import { chatCompletion, MODELS } from "@/lib/ai/client";
import type { ValidationIssue } from "./types";

const REPAIR_SYSTEM_PROMPT = `你是 Manim Community v0.21+ 调试与修复专家。

根据用户需求、当前代码和验证/渲染诊断，输出修复后的完整可运行 Python 模块。

## 硬性要求
1. 只输出完整代码（以 from manim 或 import manim 开头），不要输出 diff、解释文字或 Markdown。
2. 必须包含且只包含一个继承自 Scene、ThreeDScene 或 MovingCameraScene 的类，并实现 construct 方法。
3. 代码必须能直接用 Manim Community v0.21+ 渲染；所有导入、辅助函数和类都在同一个模块内。
4. 保留当前代码中未出错的部分和风格，只修复诊断涉及的问题。
5. 在关键修复位置用中文注释标注（# 修复: ...）。`;

function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "- [render] 位置未知: 无具体诊断，请整体检查代码";
  }
  return issues
    .map((issue) => {
      const location =
        issue.line !== undefined
          ? `第 ${issue.line} 行${
              issue.column !== undefined ? `，第 ${issue.column} 列` : ""
            }`
          : "位置未知";
      return `- [${issue.code}] ${location}: ${issue.message}`;
    })
    .join("\n");
}

/**
 * Strip one optional ```python fence from the model response.
 * The model is asked for raw code, but models occasionally wrap it in fences.
 */
function extractCodeBlock(content: string): string {
  const fenceMatch = content.match(/```(?:python|py)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return content.trim();
}

const SCENE_CLASS_PATTERN =
  /class\s+\w+\s*\(\s*(?:ThreeDScene|MovingCameraScene|Scene)\s*\)/;

/**
 * Perform exactly one model call to repair Manim code.
 *
 * The response must be a COMPLETE runnable Manim Python module — a diff is
 * never accepted. The returned code is validated to contain a Manim import and
 * a Scene/ThreeDScene/MovingCameraScene subclass before it is returned.
 *
 * The signal is forwarded to the DeepSeek client so cancellation aborts the
 * in-flight request (chatCompletion supports `signal`).
 */
export async function repairCode(input: {
  code: string;
  issues: ValidationIssue[];
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { code, issues, prompt, signal } = input;

  const messages: AIMessage[] = [
    { role: "system", content: REPAIR_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `## 用户需求\n${prompt}`,
        `## 当前代码\n\`\`\`python\n${code}\n\`\`\``,
        `## 需要修复的问题\n${formatIssues(issues)}`,
        `请输出修复后的完整 Manim Python 模块（完整代码，不是 diff）。`,
      ].join("\n\n"),
    },
  ];

  const response = await chatCompletion({
    messages,
    model: MODELS.code,
    reasoning_effort: "high",
    max_tokens: 8192,
    signal,
  });

  const repaired = extractCodeBlock(response);

  // Validation: the response must be a complete Manim module containing a
  // Scene subclass. Anything else (a diff, prose, an unrelated module) is
  // rejected so the caller never accepts a partial repair.
  const hasManimImport =
    repaired.includes("from manim") || repaired.includes("import manim");
  const hasSceneClass = SCENE_CLASS_PATTERN.test(repaired);

  if (!hasManimImport || !hasSceneClass) {
    throw new Error("Repair response missing valid Scene class");
  }

  return repaired;
}
