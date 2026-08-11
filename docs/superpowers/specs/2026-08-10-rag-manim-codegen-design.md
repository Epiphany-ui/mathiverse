# RAG-Enhanced Manim Code Generation

**Created:** 2026-08-10
**Status:** approved

## Problem

The sandbox AI assistant uses a static set of 9 few-shot examples sent on every request. Complex
animations fail in three ways:

1. **Syntax/API errors** — hallucinated Manim APIs, wrong parameter types
2. **Logic errors** — code runs but animation behavior is wrong (bad math/physics modeling)
3. **Structural failures** — cannot organize 5+ stage multi-step animations coherently

Root cause: `deepseek-chat` (v4-flash) with fixed, context-unrelated few-shot examples is
insufficient for complex Manim code generation.

## Solution

Three complementary improvements:

1. **Model upgrade** — `deepseek-chat` → `deepseek-v4-pro` for code generation
2. **Dynamic few-shot retrieval (RAG)** — vector similarity search replaces fixed examples
3. **Chain-of-thought prompt** — force reasoning before code output

Non-goal: fine-tuning (DeepSeek has no public fine-tuning API; evaluated and deferred).

## Architecture

```
User types "做一个洛伦兹吸引子的3D可视化"
        │
        ├─ 1. Ollama bge-m3 → embedding( query )
        │
        ├─ 2. Supabase pgvector cosine similarity → top-3 manim_examples
        │
        ├─ 3. Build messages: [system+cot] [top-3 examples] [history] [user msg]
        │
        ├─ 4. POST deepseek-v4-pro → stream SSE to client
        │
        └─ 5. extractCode() → editor
```

## Components

### 1. Model Configuration (`src/lib/ai/client.ts`)

| Role | Model | Temperature | Max Tokens |
|------|-------|-------------|------------|
| Code generation | `deepseek-v4-pro` | 0.4 (new) / 0.2 (edit) | 8192 |
| Metadata generation | `deepseek-v4-flash` | 0.5 | 300 |
| Error fix | `deepseek-v4-pro` | 0.2 | 8192 |

### 2. Embedding (`src/lib/ai/embedding.ts`) — new file

```typescript
// Ollama embedding client
// Model: bge-m3:latest (1024-dim, 1.2GB)
// Endpoint: http://localhost:11434/api/embed
export async function embed(text: string): Promise<number[]>
export async function embedBatch(texts: string[]): Promise<number[][]>
```

### 3. Vector Retrieval (`src/lib/ai/retrieval.ts`) — new file

```typescript
// Search manim_examples by cosine similarity
export async function retrieveExamples(
  query: string,
  k?: number  // default 3
): Promise<ManimExample[]>
```

Uses `supabase.rpc("match_manim_examples", { query_embedding, match_count: k })`.

### 4. Prompt Restructure (`src/lib/ai/prompts.ts`)

**Chain-of-thought system prompt:**

```
你是 Manim 专家。先在脑中规划场景结构，再输出代码。

## 推理步骤（在输出代码前先想清楚）
1. 拆解：用户的描述涉及几个数学对象？它们之间的关系是什么？
2. 布局：坐标系？3D空间？自由排版？
3. 时间线：分几个阶段？每个阶段展示什么？
4. 动画选择：Write/Create/Transform/FadeIn/MoveAlongPath/...
5. 参数化：哪些量需要 ValueTracker + always_redraw？

## 规则（保留现有规则）

## 参考示例（与当前请求最相似）
{retrieved_examples}
```

**`buildMessages()` updated signature:**

```typescript
export async function buildMessages(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  currentCode?: string,
): Promise<AIMessage[]>  // now async — fetches from RAG
```

The fixed `FEW_SHOT_EXAMPLES` array becomes a fallback when RAG is unavailable.

### 5. Chat API (`src/app/api/chat/route.ts`)

- Call `retrieveExamples(userMessage)` before building messages
- Pass retrieved examples to `buildMessages()`
- Fall back to static examples if retrieval fails

### 6. Error Fix Loop (`src/hooks/use-chat.ts`)

Fix mode no longer sends the error as a plain user message. Instead it calls a non-streaming
endpoint with the dedicated fix prompt (`buildFixPrompt` from prompts.ts), getting a direct
code replacement without streaming overhead.

### 7. Seed Data Pipeline (`scripts/seed-examples.ts`) — new file

Sources:
- Existing 9 few-shot examples (re-imported with embeddings)
- Manim Community official example gallery (`ManimCommunity/manim` repo `example_scenes/`)
- GitHub: `manim scene` keyword search, top repos by stars, filtered by syntax validation

Quality gates:
- Must contain `class \w+\(.*Scene\)` (valid scene definition)
- Must pass `compile(code, "<inline>", "exec")` (Python syntax check)
- AI-generated Chinese title, description, and tags (via `generateMetadata`)

Target: **100-150 examples** covering geometry, calculus, linear algebra, probability, physics,
sorting algorithms, 3D surfaces.

### 8. Database (`manim_examples` table)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE manim_examples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text NOT NULL,
  code          text NOT NULL,
  tags          text[] DEFAULT '{}',
  difficulty    smallint DEFAULT 1,
  embedding     vector(1024),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX ON manim_examples
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

RPC function for similarity search:

```sql
CREATE OR REPLACE FUNCTION match_manim_examples(
  query_embedding vector(1024),
  match_count int DEFAULT 3
) RETURNS TABLE (
  id uuid, title text, description text, code text, tags text[],
  difficulty smallint, similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.description, e.code, e.tags, e.difficulty,
         (1 - (e.embedding <=> query_embedding)) AS similarity
  FROM manim_examples e
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Ollama (local) | any | `bge-m3:latest` (1024-dim) for embedding generation |
| Supabase pgvector | pgvector 0.5+ | Vector storage + cosine similarity search |
| DeepSeek API | — | `deepseek-v4-pro` + `deepseek-v4-flash` |

## Cost

| Component | Cost |
|-----------|------|
| Ollama embedding | Free (local) |
| pgvector | Free (Supabase extension) |
| DeepSeek v4-pro | ~$0.44/1M input tokens, ~$0.87/1M output tokens |
| Storage | Negligible (~6KB per example vector) |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/ai/client.ts` | Model constants, split code vs metadata config |
| `src/lib/ai/embedding.ts` | **New** — Ollama embedding client |
| `src/lib/ai/retrieval.ts` | **New** — pgvector similarity search |
| `src/lib/ai/prompts.ts` | CoT system prompt, dynamic example injection, async `buildMessages` |
| `src/app/api/chat/route.ts` | RAG retrieval before message construction |
| `src/hooks/use-chat.ts` | Fix mode uses dedicated non-streaming endpoint |
| `scripts/seed-examples.ts` | **New** — data collection and seeding script |
| Supabase migration | pgvector extension + `manim_examples` table + RPC function |

## Acceptance Criteria

1. User types a Manim request → system retrieves top-3 semantically similar examples from pgvector
2. DeepSeek v4-pro generates code with retrieved examples as context
3. Fix mode calls dedicated fix prompt, returns corrected code
4. Seed script populates 100+ examples into `manim_examples` table
5. All existing functionality (chat, fork, publish, metadata generation) continues working
