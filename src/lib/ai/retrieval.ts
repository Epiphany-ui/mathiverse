// src/lib/ai/retrieval.ts
// pgvector similarity search for Manim examples

import { embed, isOllamaRunning } from "./embedding";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ManimExample } from "./types";

/**
 * Search manim_examples by cosine similarity to the query.
 * Falls back to empty array if Ollama or Supabase is unavailable.
 */
export async function retrieveExamples(
  query: string,
  k: number = 3,
): Promise<ManimExample[]> {
  try {
    const ollamaUp = await isOllamaRunning();
    if (!ollamaUp) {
      console.warn("[retrieval] Ollama not running — skipping RAG");
      return [];
    }

    const client = getAdminClient();
    if (!client) {
      console.warn("[retrieval] No admin client — skipping RAG");
      return [];
    }

    const queryEmbedding = await embed(query);
    if (!queryEmbedding.length) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any).rpc("match_manim_examples", {
      query_embedding: queryEmbedding,
      match_count: k,
    });

    if (error) {
      console.warn("[retrieval] RPC error:", error.message);
      return [];
    }

    return (data ?? []) as ManimExample[];
  } catch (err) {
    console.warn("[retrieval] Search failed:", err);
    return [];
  }
}

/**
 * Insert a new example into the vector store.
 * Returns the new row id, or null on failure.
 */
export async function insertExample(
  example: Omit<ManimExample, "id" | "similarity">,
): Promise<string | null> {
  try {
    const ollamaUp = await isOllamaRunning();
    if (!ollamaUp) return null;

    const client = getAdminClient();
    if (!client) return null;

    // Embed the concatenation of title + description for better semantic match
    const toEmbed = `${example.title}\n${example.description}\n${example.tags.join(", ")}`;
    const embedding = await embed(toEmbed);
    if (!embedding.length) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("manim_examples")
      .insert({ ...example, embedding })
      .select("id")
      .single();

    if (error) {
      console.warn("[retrieval] Insert failed:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.warn("[retrieval] Insert failed:", err);
    return null;
  }
}

/**
 * Try to auto-index a successfully published visualization.
 * Fire-and-forget — never throws, never blocks the caller.
 * Returns the new row id, or null if indexing wasn't possible.
 */
export async function tryAutoIndex(params: {
  code: string;
  title: string;
  description?: string;
  tags?: string[];
}): Promise<string | null> {
  try {
    // Only index if we have meaningful code
    if (!params.code || params.code.length < 50) return null;
    if (!params.code.includes("class ") || !params.code.includes("Scene")) return null;

    const tags = params.tags?.length
      ? params.tags
      : extractBasicTags(params.code);

    return await insertExample({
      title: params.title,
      description: params.description ?? params.title,
      code: params.code,
      tags,
      difficulty: estimateDifficulty(params.code),
      source: "user-published",
    });
  } catch {
    // Silently skip — indexing is best-effort
    return null;
  }
}

/** Crude tag extraction from code patterns (no dependency on seed script). */
function extractBasicTags(code: string): string[] {
  const tags: string[] = [];
  const patterns: [RegExp, string][] = [
    [/ThreeDScene/, "3D"],
    [/Axes|NumberPlane|ComplexPlane/, "坐标系"],
    [/MathTex|Tex/, "公式"],
    [/Transform|Morph/, "变换"],
    [/ValueTracker/, "参数动画"],
    [/TracedPath/, "轨迹"],
    [/np\.random|BarChart/, "统计"],
    [/np\.sin|np\.cos|Fourier/, "三角函数"],
    [/Circle|Square|Polygon|Dot/, "几何"],
    [/np\.linalg|Matrix|vector/, "线性代数"],
  ];
  for (const [re, tag] of patterns) {
    if (re.test(code)) tags.push(tag);
  }
  return [...new Set(tags)];
}

function estimateDifficulty(code: string): number {
  const lines = code.split("\n").length;
  return lines < 50 ? 1 : lines < 80 ? 2 : 3;
}

/**
 * Count examples in the store. Returns -1 on error.
 */
export async function countExamples(): Promise<number> {
  try {
    const client = getAdminClient();
    if (!client) return -1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (client as any)
      .from("manim_examples")
      .select("*", { count: "exact", head: true });

    if (error) return -1;
    return count ?? 0;
  } catch {
    return -1;
  }
}
