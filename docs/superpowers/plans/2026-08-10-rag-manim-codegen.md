# RAG-Enhanced Manim Code Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static few-shot examples with dynamic pgvector retrieval (bge-m3 embeddings via Ollama), upgrade model to deepseek-v4-pro, and add chain-of-thought prompting.

**Architecture:** At chat time, embed the user's query via Ollama bge-m3, search Supabase pgvector for top-3 similar Manim examples, inject them into a CoT system prompt, and send to deepseek-v4-pro. Fix mode uses a dedicated non-streaming prompt. A seed script populates the initial example corpus from existing few-shots + Manim official gallery.

**Tech Stack:** DeepSeek API (v4-pro + v4-flash), Ollama bge-m3 (1024-dim), Supabase pgvector, TypeScript

## Global Constraints

- Ollama must be running locally (`http://localhost:11434`) with `bge-m3:latest` pulled
- `EMBED_MODEL=bge-m3` and `OLLAMA_URL=http://localhost:11434` in `.env.local`
- `pgvector` extension enabled on Supabase project
- All existing chat/sandbox/publish functionality must continue working
- DeepSeek API key (`DEEPSEEK_API_KEY`) already configured

---

## File Map

| File | Role |
|------|------|
| `src/lib/ai/embedding.ts` | **New** — Ollama embedding client |
| `src/lib/ai/types.ts` | **New** — ManimExample type, shared interfaces |
| `src/lib/ai/retrieval.ts` | **New** — pgvector similarity search |
| `src/lib/ai/client.ts` | Modify — model constants, split code vs metadata config |
| `src/lib/ai/prompts.ts` | Modify — CoT system prompt, dynamic example injection, async buildMessages |
| `src/app/api/chat/route.ts` | Modify — RAG retrieval before message construction |
| `src/hooks/use-chat.ts` | Modify — fix mode uses dedicated non-streaming prompt |
| `scripts/seed-examples.ts` | **New** — data collection and seeding script |
| `supabase/migrations/001_enable_pgvector.sql` | **New** — pgvector extension + manim_examples table + RPC |

---

### Task 1: Database — pgvector extension, table, and RPC function

**Files:**
- Create: `supabase/migrations/001_enable_pgvector.sql`

**Interfaces:**
- Consumes: nothing
- Produces: `manim_examples` table with `vector(1024)` column, `match_manim_examples` RPC function

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/001_enable_pgvector.sql
-- Enable pgvector extension and create examples table

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE manim_examples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text NOT NULL,
  code          text NOT NULL,
  tags          text[] DEFAULT '{}',
  difficulty    smallint DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  source        text DEFAULT 'manual',
  embedding     vector(1024),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX manim_examples_embedding_idx
  ON manim_examples
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Cosine similarity search RPC
CREATE OR REPLACE FUNCTION match_manim_examples(
  query_embedding vector(1024),
  match_count int DEFAULT 3
) RETURNS TABLE (
  id uuid,
  title text,
  description text,
  code text,
  tags text[],
  difficulty smallint,
  similarity float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.code,
    e.tags,
    e.difficulty,
    (1 - (e.embedding <=> query_embedding)) AS similarity
  FROM manim_examples e
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

- [ ] **Step 2: Apply the migration**

Run: `psql "$SUPABASE_DB_URL" -f supabase/migrations/001_enable_pgvector.sql`
Or apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Verify table exists**

Run: `curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_URL/rest/v1/manim_examples?limit=1" | python3 -m json.tool`
Expected: `[]` (empty table, no error)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_enable_pgvector.sql
git commit -m "feat: add pgvector manim_examples table and search RPC"
```

---

### Task 2: Shared types and embedding client

**Files:**
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/ai/embedding.ts`

**Interfaces:**
- Consumes: `manim_examples` table from Task 1
- Produces:
  - `ManimExample` type: `{ id: string; title: string; description: string; code: string; tags: string[]; difficulty: number; similarity?: number }`
  - `embed(text: string): Promise<number[]>` — 1024-dim float array
  - `embedBatch(texts: string[]): Promise<number[][]>`

- [ ] **Step 1: Write types.ts**

```typescript
// src/lib/ai/types.ts

export interface ManimExample {
  id: string;
  title: string;
  description: string;
  code: string;
  tags: string[];
  difficulty: number;
  similarity?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}
```

- [ ] **Step 2: Write embedding.ts**

```typescript
// src/lib/ai/embedding.ts
// Ollama embedding client — bge-m3 (1024-dim)

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434";

export const EMBED_MODEL =
  process.env.EMBED_MODEL ?? "bge-m3";

export const EMBED_DIMENSIONS = 1024;

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embed error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.embeddings?.[0] ?? [];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
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
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "types\.ts|embedding\.ts"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/types.ts src/lib/ai/embedding.ts
git commit -m "feat: add Ollama bge-m3 embedding client and types"
```

---

### Task 3: Model configuration update

**Files:**
- Modify: `src/lib/ai/client.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `MODELS` constant exported, `chatCompletionStream` uses `MODELS.code`, `chatCompletion` uses `MODELS.code` or `MODELS.metadata`

- [ ] **Step 1: Add model constants and update defaults**

```typescript
// In src/lib/ai/client.ts — replace hardcoded "deepseek-chat" with configurable model IDs

// Add at top of file, after imports:
export const MODELS = {
  /** Primary model for Manim code generation — stronger reasoning */
  code: "deepseek-v4-pro",
  /** Lighter model for metadata generation */
  metadata: "deepseek-v4-flash",
} as const;

// Defaults (replace hardcoded values):
// temperature: request.temperature ?? 0.4  (was 0.3)
// max_tokens: request.max_tokens ?? 8192   (was 4096)
// model: request.model ?? MODELS.code      (was "deepseek-chat")
```

- [ ] **Step 2: Update ChatCompletionRequest to accept optional model**

```typescript
export interface ChatCompletionRequest {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  model?: string;  // NEW — override default model
}
```

- [ ] **Step 3: Update both functions to use model from request or MODELS.code**

In `chatCompletion()` body, change:
```typescript
// was:
model: "deepseek-chat",

// now:
model: request.model ?? MODELS.code,
```

In `chatCompletionStream()` body, same change:
```typescript
model: request.model ?? MODELS.code,
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "client\.ts"`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/client.ts
git commit -m "feat: upgrade to deepseek-v4-pro/v4-flash with configurable models"
```

---

### Task 4: Vector retrieval module

**Files:**
- Create: `src/lib/ai/retrieval.ts`

**Interfaces:**
- Consumes: `embed` from Task 2, `ManimExample` from Task 2, `match_manim_examples` RPC from Task 1, Supabase admin client from `src/lib/supabase/admin.ts`
- Produces:
  - `retrieveExamples(query: string, k?: number): Promise<ManimExample[]>`
  - `insertExample(example: Omit<ManimExample, "id">, embedding: number[]): Promise<string | null>`

- [ ] **Step 1: Write retrieval.ts**

```typescript
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

    const { data, error } = await client.rpc("match_manim_examples", {
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

    const { data, error } = await client
      .from("manim_examples")
      .insert({ ...example, embedding })
      .select("id")
      .single();

    if (error) {
      console.warn("[retrieval] Insert failed:", error.message);
      return null;
    }

    return data.id;
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

    const { count, error } = await client
      .from("manim_examples")
      .select("*", { count: "exact", head: true });

    if (error) return -1;
    return count ?? 0;
  } catch {
    return -1;
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "retrieval\.ts"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/retrieval.ts
git commit -m "feat: add pgvector retrieval for dynamic Manim examples"
```

---

### Task 5: Prompt restructure — CoT + dynamic examples

**Files:**
- Modify: `src/lib/ai/prompts.ts`

**Interfaces:**
- Consumes: `retrieveExamples` from Task 4, `ManimExample` from Task 2
- Produces: `buildMessages()` is now async, `SYSTEM_PROMPT` updated with CoT, `formatRetrievedExamples()` helper

- [ ] **Step 1: Update system prompt with chain-of-thought**

```typescript
// src/lib/ai/prompts.ts — replace SYSTEM_PROMPT

export const SYSTEM_PROMPT = `你是 Mathiverse 的 Manim 动画专家助手。你的任务是根据用户的自然语言描述，生成高质量的 Manim Community v0.19+ Python 代码。

## 推理步骤（在生成代码前，先在脑中规划）

对于用户的请求，按以下步骤思考：
1. **拆解**：用户描述涉及几个数学对象？它们之间是什么关系？
2. **布局**：需要坐标系(Axes/NumberPlane/ComplexPlane)？3D空间(ThreeDScene)？还是自由排版？
3. **时间线**：动画分几个阶段？每个阶段展示什么？（用注释标注阶段）
4. **动画选择**：Write/Create/Transform/FadeIn/MoveAlongPath/ApplyMatrix/...
5. **参数化**：哪些量需要 ValueTracker + always_redraw 实现动态更新？

## 两种工作模式

### 模式 1: 创建新代码
- 从头生成完整的 Manim 场景
- 在代码中用中文注释标注推理步骤中的阶段划分

### 模式 2: 修改现有代码
- 基于现有代码进行修改
- 保持代码结构和风格一致
- 只修改用户要求的部分，不要重写整个场景
- 输出完整的修改后代码（包含所有 import）

## 规则
1. 只输出有效的 Python 代码，不要输出额外的解释文字或 Markdown 标记。
2. 代码必须能直接用 Manim Community v0.19+ 渲染运行。
3. 使用中文注释解释关键步骤和阶段划分。
4. 优先使用：MathTex, Tex, Axes, NumberPlane, VGroup, always_redraw, ValueTracker, TracedPath
5. 动画要流畅美观，使用合适的颜色和时长。
6. 场景类名使用有意义的英文名。
7. 复杂动画拆分为 helper 方法，保持 construct() 清晰。
8. 若描述不清晰，生成合理的默认可视化。

## 常用的 Manim 模式
- 坐标系可视化：Axes + plot + always_redraw
- 几何图形：Circle, Square, Polygon, Dot + Transform/animate
- 公式展示：MathTex + Write/Transform
- 3D 场景：ThreeDScene + set_camera_orientation + begin_ambient_camera_rotation
- 参数动画：ValueTracker + always_redraw
- 运动轨迹：TracedPath + MoveAlongPath
- 线性变换：ApplyMatrix
- 概率统计：BarChart / Axes + plot

## 示例输出格式
\`\`\`python
from manim import *
import numpy as np

class SceneName(Scene):
    def construct(self):
        # 阶段 1: ...
        pass
\`\`\``;
```

- [ ] **Step 2: Add formatRetrievedExamples helper**

```typescript
// In src/lib/ai/prompts.ts — add after SYSTEM_PROMPT

/**
 * Format retrieved examples for injection into the system prompt.
 */
export function formatRetrievedExamples(
  examples: { title: string; description: string; code: string }[],
): string {
  if (!examples.length) return "";

  return examples
    .map(
      (ex, i) =>
        `### 示例 ${i + 1}: ${ex.title}\n${ex.description}\n\n\`\`\`python\n${ex.code}\n\`\`\``,
    )
    .join("\n\n---\n\n");
}
```

- [ ] **Step 3: Make buildMessages async with RAG**

```typescript
// In src/lib/ai/prompts.ts — replace buildMessages

/**
 * Build the full message array for a chat completion request.
 * Now async — fetches relevant examples via RAG.
 */
export async function buildMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  currentCode?: string,
): Promise<AIMessage[]> {
  const systemContent = buildSystemPrompt(currentCode);

  // Try RAG retrieval; fall back to static examples if unavailable
  let exampleSection = "";
  try {
    const { retrieveExamples } = await import("./retrieval");
    const examples = await retrieveExamples(userMessage, 3);
    if (examples.length) {
      exampleSection = `\n\n## 参考示例（与当前请求最相似）\n\n${formatRetrievedExamples(examples)}`;
    }
  } catch {
    // RAG unavailable — use static fallback
  }

  if (!exampleSection) {
    // Static fallback: embed existing few-shot examples as inline context
    exampleSection = `\n\n## 参考示例\n\n${formatRetrievedExamples(
      FEW_SHOT_EXAMPLES.filter((_, i) => i % 3 === 0).map((ex) => ({
        title: "示例",
        description: (ex as { role: string; content: string }).role === "user"
          ? (ex as { content: string }).content
          : "",
        code: (ex as { role: string; content: string }).role === "assistant"
          ? (ex as { content: string }).content
          : "",
      })).filter((ex) => ex.code),
    )}`;
  }

  return [
    { role: "system" as const, content: systemContent + exampleSection },
    ...history,
    { role: "user" as const, content: userMessage },
  ];
}
```

- [ ] **Step 4: Add AIMessage type to prompts.ts**

```typescript
// Add at top of prompts.ts imports:
import type { AIMessage } from "./client";
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompts\.ts"`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: add CoT system prompt and dynamic RAG example injection"
```

---

### Task 6: Chat API — integrate RAG retrieval

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Interfaces:**
- Consumes: `buildMessages` (now async) from Task 5, `MODELS` from Task 3
- Produces: unchanged SSE response format

- [ ] **Step 1: Update route to await async buildMessages**

```typescript
// src/app/api/chat/route.ts

import { NextRequest } from "next/server";
import { chatCompletionStream, isConfigured, MODELS } from "@/lib/ai/client";
import { buildMessages } from "@/lib/ai/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = body.messages ?? [];
    const currentCode = (body.currentCode as string) ?? undefined;

    if (!isConfigured()) {
      return new Response(
        JSON.stringify({
          error: "DeepSeek API 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const lastUserMsg =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";

    if (!lastUserMsg) {
      return new Response(
        JSON.stringify({ error: "请提供用户消息" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const history = messages.slice(0, -1).filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant",
    );

    // Now async — fetches RAG examples
    const fullMessages = await buildMessages(history, lastUserMsg, currentCode);

    const stream = await chatCompletionStream({
      messages: fullMessages,
      model: MODELS.code,
      temperature: 0.4,
      max_tokens: 8192,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "未知错误",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "chat/route\.ts"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: integrate RAG retrieval into chat API endpoint"
```

---

### Task 7: Fix mode — use dedicated non-streaming prompt

**Files:**
- Modify: `src/hooks/use-chat.ts`

**Interfaces:**
- Consumes: `buildFixPrompt` from `@/lib/ai/prompts`, `chatCompletion` from `@/lib/ai/client`, `MODELS` from Task 3
- Produces: `sendMessage(content, currentCode, isFixMode?)` — when `isFixMode`, calls dedicated fix endpoint

- [ ] **Step 1: Add a server-side fix endpoint**

Create: `src/app/api/chat/fix/route.ts`

```typescript
// src/app/api/chat/fix/route.ts
// Non-streaming endpoint for AI error fixing

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, isConfigured, MODELS } from "@/lib/ai/client";
import { buildFixPrompt, extractCode } from "@/lib/ai/prompts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, error: renderError } = body;

    if (!isConfigured()) {
      return NextResponse.json(
        { error: "DeepSeek API 未配置" },
        { status: 503 },
      );
    }

    if (!code || !renderError) {
      return NextResponse.json(
        { error: "请提供代码和错误信息" },
        { status: 400 },
      );
    }

    const prompt = buildFixPrompt(code, renderError);

    const response = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      model: MODELS.code,
      temperature: 0.2,
      max_tokens: 8192,
    });

    const fixedCode = extractCode(response);
    return NextResponse.json({ code: fixedCode || response });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Update useChat fix mode to call dedicated endpoint**

In `src/hooks/use-chat.ts`, modify `sendMessage` — when `isFixMode` is true:

```typescript
// Inside sendMessage, after the isFixMode check:

if (isFixMode) {
  // Use dedicated non-streaming fix endpoint
  setMessages((prev) => [...prev, userMsg]);

  const assistantId = `assistant-${Date.now()}`;
  const assistantMsg: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: "",
  };
  setMessages((prev) => [...prev, assistantMsg]);
  setIsLoading(true);

  try {
    const res = await fetch("/api/chat/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: currentCode,
        error: content, // content is the render error when isFixMode
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error ?? "修复失败");

    const fixedCode = data.code;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "已根据错误信息修复代码。", code: fixedCode }
          : m,
      ),
    );

    if (fixedCode && onCodeExtracted) {
      onCodeExtracted(fixedCode);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "修复失败";
    setError(msg);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `❌ 修复失败: ${msg}` }
          : m,
      ),
    );
  } finally {
    setIsLoading(false);
  }

  return; // Don't continue to streaming path
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "use-chat\.ts|fix/route\.ts"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-chat.ts src/app/api/chat/fix/route.ts
git commit -m "feat: add dedicated non-streaming AI fix endpoint"
```

---

### Task 8: Seed script — populate example corpus

**Files:**
- Create: `scripts/seed-examples.ts`

**Interfaces:**
- Consumes: `embed` from Task 2, `insertExample` from Task 4, `FEW_SHOT_EXAMPLES` from prompts.ts, `generateMetadata` from prompts.ts
- Produces: populates `manim_examples` table with 100+ examples

- [ ] **Step 1: Write seed script**

```typescript
#!/usr/bin/env npx tsx
// scripts/seed-examples.ts
// Seed the manim_examples vector store with initial examples.

import "dotenv/config";
import { embed, isOllamaRunning } from "../src/lib/ai/embedding";
import { insertExample, countExamples } from "../src/lib/ai/retrieval";
import { FEW_SHOT_EXAMPLES, generateMetadata } from "../src/lib/ai/prompts";

interface RawExample {
  title: string;
  description: string;
  code: string;
  tags: string[];
  difficulty: number;
  source: string;
}

// ─── Source 1: existing few-shot examples ───

function extractExistingExamples(): RawExample[] {
  const examples: RawExample[] = [];
  for (let i = 0; i < FEW_SHOT_EXAMPLES.length; i += 2) {
    const userMsg = FEW_SHOT_EXAMPLES[i];
    const assistantMsg = FEW_SHOT_EXAMPLES[i + 1];
    if (!assistantMsg) break;

    const code = assistantMsg.content;
    // Estimate difficulty from line count
    const lines = code.split("\n").length;
    const difficulty = lines < 50 ? 1 : lines < 80 ? 2 : 3;

    examples.push({
      title: userMsg.content.slice(0, 60),
      description: userMsg.content,
      code,
      tags: extractTagsFromCode(code),
      difficulty,
      source: "existing-fewshot",
    });
  }
  return examples;
}

function extractTagsFromCode(code: string): string[] {
  const tags: string[] = [];
  const tagPatterns: [RegExp, string][] = [
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
  for (const [re, tag] of tagPatterns) {
    if (re.test(code)) tags.push(tag);
  }
  return [...new Set(tags)];
}

// ─── Source 2: Manim official gallery (fetched via GitHub API) ───

async function fetchManimGallery(): Promise<RawExample[]> {
  const examples: RawExample[] = [];
  const baseUrl =
    "https://api.github.com/repos/ManimCommunity/manim/contents/example_scenes";

  try {
    const res = await fetch(baseUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "mathiverse-seeder",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[seed] GitHub API returned ${res.status} — skipping gallery`);
      return examples;
    }

    const files = (await res.json()) as { name: string; download_url: string }[];

    for (const file of files.slice(0, 60)) {
      if (!file.name.endsWith(".py")) continue;

      try {
        const codeRes = await fetch(file.download_url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!codeRes.ok) continue;

        const code = await codeRes.text();
        if (!code.includes("class ") || !code.includes("Scene")) continue;

        // Validate syntax
        try {
          new Function(code); // won't execute, just parse
        } catch {
          // Skip invalid Python
          continue;
        }

        const lines = code.split("\n").length;
        const difficulty = lines < 50 ? 1 : lines < 80 ? 2 : 3;
        const className = code.match(/class\s+(\w+)\s*\(/)?.[1] ?? "Unknown";

        examples.push({
          title: className,
          description: `Manim official example: ${className}`,
          code,
          tags: extractTagsFromCode(code),
          difficulty,
          source: "manim-gallery",
        });
      } catch {
        // Skip individual file errors
      }
    }
  } catch (err) {
    console.warn("[seed] Failed to fetch Manim gallery:", err);
  }

  return examples;
}

// ─── Main ───

async function main() {
  console.log("[seed] Checking Ollama...");
  const ollamaUp = await isOllamaRunning();
  if (!ollamaUp) {
    console.error("[seed] Ollama is not running. Start it first: ollama serve");
    process.exit(1);
  }

  const existing = await countExamples();
  if (existing > 0) {
    console.log(`[seed] ${existing} examples already exist. Skipping (delete rows to re-seed).`);
    process.exit(0);
  }

  console.log("[seed] Collecting examples...");
  const existingExamples = extractExistingExamples();
  const galleryExamples = await fetchManimGallery();
  const allExamples = [...existingExamples, ...galleryExamples];

  console.log(`[seed] Got ${existingExamples.length} existing + ${galleryExamples.length} gallery = ${allExamples.length} total`);

  let inserted = 0;
  for (const ex of allExamples) {
    // Generate AI metadata for gallery examples (existing ones already have titles)
    let title = ex.title;
    let description = ex.description;
    if (ex.source === "manim-gallery") {
      try {
        const meta = await generateMetadata(ex.code.slice(0, 200), ex.code);
        title = meta.title;
        description = meta.description;
        ex.tags = [...new Set([...ex.tags, ...meta.tags])];
      } catch {
        // Keep defaults
      }
    }

    const id = await insertExample({
      title,
      description,
      code: ex.code,
      tags: ex.tags,
      difficulty: ex.difficulty,
      source: ex.source,
    });

    if (id) {
      inserted++;
      console.log(`[seed] ✓ ${title}`);
    } else {
      console.log(`[seed] ✗ FAILED: ${title}`);
    }

    // Rate limit: Ollama embedding is local but still consumes CPU
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n[seed] Done. Inserted ${inserted}/${allExamples.length} examples.`);
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add dotenv if not present**

Run: `grep "dotenv" package.json || echo "Need to install dotenv"`

If missing: `npm install dotenv` (seed script uses `dotenv/config` to load `.env.local`).

- [ ] **Step 3: Run seed script**

```bash
npx tsx scripts/seed-examples.ts
```

Expected: inserts 50-100+ examples with embeddings.

- [ ] **Step 4: Verify with a quick count**

```typescript
// Run a quick inline check:
// npx tsx -e "
//   import { countExamples } from './src/lib/ai/retrieval';
//   countExamples().then(c => console.log('Count:', c));
// "
```

Expected: `Count: >50`

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-examples.ts
git commit -m "feat: add seed script for manim_examples vector store"
```

---

### Task 9: Environment configuration

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add embedding configuration to .env.local**

```bash
# Ollama embedding config
OLLAMA_URL=http://localhost:11434
EMBED_MODEL=bge-m3
```

- [ ] **Step 2: Pull bge-m3 model (user side)**

```bash
ollama pull bge-m3
```

- [ ] **Step 3: Commit**

```bash
git add .env.local
git commit -m "chore: add Ollama embedding env vars"
```

---

### Task 10: Metadata generation — switch to v4-flash

**Files:**
- Modify: `src/lib/ai/prompts.ts` (generateMetadata function)

- [ ] **Step 1: Update generateMetadata to use MODELS.metadata**

In `generateMetadata()`, pass `model: MODELS.metadata`:

```typescript
// In the chatCompletion call inside generateMetadata:
const response = await chatCompletion({
  messages: [
    { role: "system", content: METADATA_SYSTEM_PROMPT },
    {
      role: "user",
      content: `用户需求: ${userPrompt}\n\n代码:\n\`\`\`python\n${code.slice(0, 3000)}\n\`\`\``,
    },
  ],
  model: MODELS.metadata,  // NEW
  temperature: 0.5,
  max_tokens: 300,
});
```

Note: `MODELS` is imported from `./client`.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompts\.ts"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: use deepseek-v4-flash for metadata generation"
```

---

### Task 11: Integration smoke test

- [ ] **Step 1: Start all services**

```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: Python renderer
cd renderer && uv run python server.py

# Terminal 3: Next.js
npm run dev
```

- [ ] **Step 2: Test RAG chat flow**

1. Open `http://localhost:3000/sandbox`
2. Type: "在复平面上展示欧拉公式 e^(iθ) 的轨迹"
3. Verify: code is generated, appears in editor
4. Click "渲染" — verify video renders
5. Check server logs for RAG retrieval success (no warnings)

- [ ] **Step 3: Test fix mode**

1. In sandbox, intentionally break the code (add syntax error)
2. Click "渲染" — should fail with error
3. Click "AI 修复" — should call `/api/chat/fix` and return corrected code

- [ ] **Step 4: Test metadata generation**

1. Render a successful animation
2. Click "发布" — verify AI-generated title/description/tags appear
3. Publish and visit `/v/[id]` — verify correct

- [ ] **Step 5: Test RAG fallback**

1. Stop Ollama: `killall ollama`
2. Type a chat message — should still work (using static fallback)
3. Restart Ollama

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "test: integration smoke tests pass"
```
