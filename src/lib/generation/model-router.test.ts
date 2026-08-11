import assert from "node:assert/strict";
import test from "node:test";
import { routeGenerationModel } from "./model-router";

test("complex scenes route to Pro with a bounded budget", () => {
  assert.deepEqual(routeGenerationModel("generate", "complex"), {
    model: "deepseek-v4-pro",
    reasoningEffort: "max",
    maxTokens: 12288,
  });
});

test("simple scenes use Flash without reasoning", () => {
  assert.deepEqual(routeGenerationModel("generate", "simple"), {
    model: "deepseek-v4-flash",
    thinking: { type: "disabled" },
    maxTokens: 4096,
  });
});
