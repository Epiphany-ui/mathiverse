#!/usr/bin/env npx tsx
/**
 * Seed wiki entries using DeepSeek API (no Wikipedia fetch needed).
 * Uses the same AI client as the app's chat/rewrite pipeline.
 *
 * Usage:
 *   npx tsx scripts/seed-wiki.ts                  # seed first 3 entries
 *   npx tsx scripts/seed-wiki.ts --all             # seed entire manifest
 *   npx tsx scripts/seed-wiki.ts --slug=fourier-series  # single entry
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.warn("[seed-wiki] Could not load .env.local");
  }
}
loadEnvLocal();

async function main() {
  const { WIKI_MANIFEST } = await import("../src/lib/wiki/manifest");
  type WikiManifestItem = typeof WIKI_MANIFEST[number];
  const { chatCompletion } = await import("../src/lib/ai/client");
  const { buildWikiRewriteMessages } = await import("../src/lib/wiki/prompts");
  const { getAdminClient } = await import("../src/lib/supabase/admin");

  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const slugIdx = args.indexOf("--slug");
  const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;
  const force = args.includes("--force");

  const client = getAdminClient();
  if (!client) {
    console.error("[seed-wiki] SUPABASE_SERVICE_ROLE_KEY 未配置");
    process.exit(1);
  }

  // Check which entries already exist
  const { data: existing } = await (client as any)
    .from("wiki_entries")
    .select("slug");
  const existingSlugs = new Set((existing ?? []).map((e: any) => e.slug));

  let entries: WikiManifestItem[];
  if (targetSlug) {
    const found = WIKI_MANIFEST.find((i) => i.slug === targetSlug);
    if (!found) { console.error(`Not found: ${targetSlug}`); process.exit(1); }
    entries = [found];
  } else if (all) {
    entries = WIKI_MANIFEST;
  } else {
    entries = WIKI_MANIFEST.slice(0, 3); // Default: first 3
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of entries) {
    if (existingSlugs.has(item.slug) && !force) {
      console.log(`[seed-wiki] SKIP ${item.slug} (already exists)`);
      skipped++;
      continue;
    }

    console.log(`[seed-wiki] Generating: ${item.slug}`);

    try {
      // Call DeepSeek to generate encyclopedia content from its knowledge
      // (no Wikipedia fetch — the model already knows this math)
      const prompt = `请写一篇关于 "${item.wikipediaTitle.replace(/_/g, " ").replace(/%27/g, "'")}" 的中文数学百科词条。

这是一个数学概念，属于 ${item.category === "pure-math" ? "纯数学" : item.category === "applied-math" ? "应用数学" : "计算机科学交叉领域"}。
标签: ${(item.tags ?? []).join(", ")}

请严格按照以下规则：
1. 定义先行：第一段给出核心概念的严谨中文定义
2. 使用 ## 分节：引入、定义与形式化、关键性质、历史与应用、动画灵感
3. 所有数学公式用 KaTeX: 行内 $...$ 独立 $$...$$
4. 动画灵感节给 2-3 个具体的 Manim 动画点子
5. 全文 1500-3500 字
6. 严格输出 JSON: {"title":"中文标题","summary":"1-2句摘要","bodyMd":"Markdown正文"}`;

      const content = await chatCompletion({
        messages: [
          {
            role: "system",
            content:
              "你是 Mathiverse 的数学百科主编。输出严格的 JSON，不要多余文字。数学公式用 KaTeX ($...$ 和 $$...$$)。",
          },
          { role: "user", content: prompt },
        ],
        model: "deepseek-v4-pro",
        thinking: { type: "disabled" },
        temperature: 0.4,
        max_tokens: 8000,
      });

      // Parse JSON from response — brace-counting to handle LaTeX { } inside strings
      function extractJson(text: string): string | null {
        // First try ```json ... ``` fences
        const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const target = fenceMatch?.[1] ?? text;
        const start = target.indexOf("{");
        if (start === -1) return null;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < target.length; i++) {
          const ch = target[i];
          if (escaped) { escaped = false; continue; }
          if (ch === "\\") { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === "{") depth++;
          if (ch === "}") { depth--; if (depth === 0) return target.slice(start, i + 1); }
        }
        return null;
      }

      let parsed: { title?: string; summary?: string; bodyMd?: string };
      const jsonStr = extractJson(content);
      if (jsonStr) {
        const tryParse = (raw: string) => {
          try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
        };
        // Try direct parse, then sanitize LaTeX backslash escapes and retry
        parsed =
          tryParse(jsonStr) ??
          tryParse(jsonStr.replace(/(?<!\\)\\(?![\\/bfnrt"'])/g, "\\\\")) ??
          {};
      } else {
        console.warn(`[seed-wiki] Could not find JSON in AI response for ${item.slug}`);
        console.warn(`  Raw (first 200): ${content.slice(0, 200)}`);
        failed++;
        continue;
      }

      // Upsert
      const { error } = await (client as any)
        .from("wiki_entries")
        .upsert(
          {
            slug: item.slug,
            title: parsed.title ?? item.slug.replace(/-/g, " "),
            category: item.category,
            summary: parsed.summary ?? "",
            body_md: parsed.bodyMd ?? content,
            tags: item.tags ?? [],
            wikipedia_title: null,
            wikipedia_url: null,
            is_published: true,
          },
          { onConflict: "slug" },
        );

      if (error) {
        console.error(`[seed-wiki] ✗ ${item.slug}: ${error.message}`);
        failed++;
      } else {
        console.log(`[seed-wiki] ✓ ${item.slug} "${parsed.title}" (${(parsed.bodyMd ?? "").length} chars)`);
        ok++;
      }
    } catch (err: unknown) {
      console.error(`[seed-wiki] ✗ ${item.slug}: ${err instanceof Error ? err.message : "unknown"}`);
      failed++;
    }

    // Small delay between entries
    if (entries.indexOf(item) < entries.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone: ${ok} OK, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
