// src/lib/ai/embedding.ts
// Ollama embedding client — bge-m3 (1024-dim)

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434";

export const EMBED_MODEL =
  process.env.EMBED_MODEL ?? "bge-m3";

export const EMBED_DIMENSIONS = 1024;

export async function embed(text: string, signal?: AbortSignal): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embed error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embeddings?.[0] ?? [];
}

export async function embedBatch(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embed batch error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embeddings ?? [];
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
