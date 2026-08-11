import type { GenerationOperation, ScenePlan } from "./types";
import { MODELS } from "@/lib/ai/client";

export interface ModelRoute {
  model: (typeof MODELS)[keyof typeof MODELS];
  reasoningEffort?: "high" | "max";
  thinking?: { type: "disabled" };
  maxTokens: 4096 | 8192 | 12288;
}

/**
 * Route a generation operation to the appropriate model with a bounded
 * token budget based on operation type and estimated complexity.
 */
export function routeGenerationModel(
  operation: GenerationOperation,
  complexity: ScenePlan["estimatedComplexity"],
): ModelRoute {
  // Repairs need reasoning but not the heaviest model
  if (operation === "repair") {
    return {
      model: MODELS.code,
      reasoningEffort: "high",
      maxTokens: 8192,
    };
  }

  // Simple scenes: fast model, no reasoning overhead
  if (complexity === "simple") {
    return {
      model: MODELS.metadata,
      thinking: { type: "disabled" },
      maxTokens: 4096,
    };
  }

  // Standard/complex: full reasoning
  return {
    model: MODELS.code,
    reasoningEffort: complexity === "complex" ? "max" : "high",
    maxTokens: complexity === "complex" ? 12288 : 8192,
  };
}

/**
 * High-quality render uses no model — this is a sentinel for the orchestrator.
 */
export function isModelRequired(operation: GenerationOperation): boolean {
  return operation === "generate" || operation === "repair";
}
