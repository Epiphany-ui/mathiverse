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
