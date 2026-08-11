import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGenerationMessages,
  filterRetrievedExamples,
} from "./generation-context";
import type { ScenePlan } from "./types";
import type { VerifiedManimExample } from "@/lib/ai/types";
import { embed } from "@/lib/ai/embedding";
import { tryAutoIndex } from "@/lib/ai/retrieval";

const samplePlan: ScenePlan = {
  objects: ["Circle", "Axes"],
  layout: "2d",
  stages: [{ title: "建立场景", intent: "显示单位圆" }],
  trackers: [],
  estimatedComplexity: "simple",
};

function allContent(messages: { content: string }[]): string {
  return messages.map((m) => m.content).join("\n");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("buildGenerationMessages", () => {
  it("new work never includes placeholder code", () => {
    const messages = buildGenerationMessages({
      prompt: "画一个单位圆",
      mode: "new",
      currentCode: "from manim import *\nclass FirstScene(Scene):\n    pass",
      plan: samplePlan,
      examples: [],
    });

    const content = allContent(messages);
    assert.ok(!content.includes("FirstScene"));
  });

  it("edit code appears exactly once in model context", () => {
    const code =
      "class CircleDemo(Scene):\n    def construct(self):\n        self.play(Create(Circle()))";
    const messages = buildGenerationMessages({
      prompt: "给圆加一个箭头",
      mode: "edit",
      currentCode: code,
      plan: samplePlan,
      examples: [],
    });

    const occurrences = messages.reduce(
      (total, m) => total + countOccurrences(m.content, code),
      0,
    );
    assert.equal(occurrences, 1);
  });

  it("includes only render-verified examples", () => {
    const trusted: VerifiedManimExample = {
      id: "trusted",
      title: "Verified circle",
      description: "A rendered scene",
      code: "class TrustedCircle(Scene):\n    pass",
      tags: ["geometry"],
      difficulty: 1,
      dimension: "2d",
      manimVersion: "0.20.1",
      renderVerified: true,
      renderHash: "sha256:trusted",
    };
    const untrusted = { ...trusted, id: "untrusted", code: "UNTRUSTED", renderVerified: false };
    const content = allContent(buildGenerationMessages({
      prompt: "circle",
      mode: "new",
      currentCode: null,
      plan: samplePlan,
      examples: [trusted, untrusted],
    }));
    assert.match(content, /TrustedCircle/);
    assert.doesNotMatch(content, /UNTRUSTED/);
  });
});

describe("filterRetrievedExamples", () => {
  it("retrieval drops unverified, incompatible, and weak matches", () => {
    const rows = [
      {
        id: "a",
        title: "单位圆",
        description: "显示单位圆",
        code: "class CircleDemo(Scene):\n    pass",
        tags: ["几何"],
        difficulty: 1,
        similarity: 0.92,
        dimension: "2d",
        manimVersion: "0.19",
        renderVerified: true,
        renderHash: "hash-a",
      },
      {
        id: "b",
        title: "未验证示例",
        description: "未被渲染验证",
        code: "class Unverified(Scene):\n    pass",
        tags: ["几何"],
        difficulty: 1,
        similarity: 0.95,
        dimension: "2d",
        manimVersion: "0.19",
        renderVerified: false,
        renderHash: null,
      },
      {
        id: "c",
        title: "弱匹配",
        description: "相似度过低",
        code: "class WeakMatch(Scene):\n    pass",
        tags: ["几何"],
        difficulty: 1,
        similarity: 0.5,
        dimension: "2d",
        manimVersion: "0.19",
        renderVerified: true,
        renderHash: "hash-c",
      },
      {
        id: "d",
        title: "维度不符",
        description: "3D 示例",
        code: "class ThreeD(Scene):\n    pass",
        tags: ["3D"],
        difficulty: 2,
        similarity: 0.9,
        dimension: "3d",
        manimVersion: "0.19",
        renderVerified: true,
        renderHash: "hash-d",
      },
      {
        id: "e",
        title: "版本不符",
        description: "旧版 Manim",
        code: "class OldManim(Scene):\n    pass",
        tags: ["几何"],
        difficulty: 1,
        similarity: 0.9,
        dimension: "2d",
        manimVersion: "0.18",
        renderVerified: true,
        renderHash: "hash-e",
      },
      {
        id: "f",
        title: "难度过高",
        description: "复杂场景",
        code: "class TooHard(Scene):\n    pass",
        tags: ["3D"],
        difficulty: 3,
        similarity: 0.9,
        dimension: "2d",
        manimVersion: "0.19",
        renderVerified: true,
        renderHash: "hash-f",
      },
    ];

    const result = filterRetrievedExamples(rows, {
      minSimilarity: 0.8,
      dimension: "2d",
      manimVersion: "0.19",
      maxDifficulty: 2,
    });

    assert.deepEqual(result.map((r) => r.id), ["a"]);
    assert.equal(result[0].renderHash, "hash-a");
  });
});

describe("abort and indexing quality gates", () => {
  it("passes the caller AbortSignal to the embedding request", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let seenSignal: AbortSignal | null | undefined;
    globalThis.fetch = (async (_input, init) => {
      seenSignal = init?.signal;
      return new Response(JSON.stringify({ embeddings: [[1, 2, 3]] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      await embed("circle", controller.signal);
      assert.equal(seenSignal, controller.signal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not index published code without trusted render evidence", async () => {
    const result = await tryAutoIndex({
      code: "from manim import *\nclass PublishedScene(Scene):\n    def construct(self):\n        self.add(Circle())",
      title: "Published",
    });
    assert.equal(result, null);
  });
});
