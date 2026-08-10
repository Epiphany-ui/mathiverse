/**
 * Wikipedia ingestion pipeline:
 *   1. Fetch plain-text content from Wikipedia REST + Query APIs
 *   2. Rewrite with DeepSeek into Chinese markdown with KaTeX
 *   3. Upsert into Supabase wiki_entries table
 *
 * No auth required — Wikipedia APIs are public.
 * Admin client required for DB writes — calls getAdminClient().
 */

import type { WikiManifestItem } from "./manifest";
import { buildWikiRewriteMessages } from "./prompts";
import { chatCompletion } from "@/lib/ai/client";
import { getAdminClient } from "@/lib/supabase/admin";

export interface IngestResult {
  ok: boolean;
  slug: string;
  entryId?: string;
  error?: string;
}

interface WikipediaSource {
  intro: string;
  fullText: string;
  coverUrl: string | null;
  pageUrl: string;
}

const USER_AGENT = "Mathiverse/0.1 (wiki-ingest; https://github.com/Epiphany-ui/mathiverse)";
const MAX_TEXT_LENGTH = 60_000;

// ─── Fetch ──────────────────────────────────────────────────────────

export async function fetchWikipediaContent(
  item: WikiManifestItem,
): Promise<WikipediaSource> {
  const lang = item.lang ?? "en";
  const title = item.wikipediaTitle;

  // 1. REST API summary — lead paragraph + cover image + page URL
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const summaryRes = await fetch(summaryUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  let intro = "";
  let coverUrl: string | null = null;
  let pageUrl = `https://${lang}.wikipedia.org/wiki/${title}`;

  if (summaryRes.ok) {
    const summary = await summaryRes.json();
    if (summary.type === "disambiguation" || summary.type === "missing") {
      throw new Error(`Wikipedia page not found (type: ${summary.type})`);
    }
    intro = summary.extract ?? "";
    coverUrl = summary.originalimage?.source ?? null;
    pageUrl = summary.content_urls?.desktop?.page ?? pageUrl;
  } else if (summaryRes.status === 404) {
    throw new Error(`Wikipedia page not found (404): ${title}`);
  }
  // Non-404 errors: proceed with empty intro

  // 2. Query API — full plain-text extract
  const queryUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exsectionformat=plain&titles=${title}&origin=*`;
  const queryRes = await fetch(queryUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  let fullText = "";
  if (queryRes.ok) {
    const queryData = await queryRes.json();
    const pages = queryData.query?.pages ?? {};
    const firstPage = Object.values(pages)[0] as any;
    fullText = firstPage?.extract ?? "";
  }

  if (!fullText && !intro) {
    throw new Error(`No content retrieved for ${title}`);
  }

  return {
    intro: (intro || fullText.slice(0, 500)).slice(0, 1000),
    fullText: fullText.slice(0, MAX_TEXT_LENGTH),
    coverUrl,
    pageUrl,
  };
}

// ─── Rewrite ────────────────────────────────────────────────────────

export async function rewriteEntry(
  item: WikiManifestItem,
  source: WikipediaSource,
): Promise<{ title: string; summary: string; bodyMd: string }> {
  const messages = buildWikiRewriteMessages(source.intro, source.fullText);

  const content = await chatCompletion({
    messages,
    model: "deepseek-v4-pro",
    thinking: { type: "disabled" },
    temperature: 0.3,
    max_tokens: 8000,
  });

  // Parse JSON from the AI response — brace-counting to handle LaTeX { } inside strings
  function extractJson(text: string): string | null {
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

  const jsonStr = extractJson(content);
  if (jsonStr) {
    const tryParse = (raw: string) => {
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
    };
    const parsed =
      tryParse(jsonStr) ??
      tryParse(jsonStr.replace(/(?<!\\)\\(?![\\/bfnrt"'])/g, "\\\\"));
    if (parsed) {
      return {
        title: (parsed.title as string) ?? item.slug.replace(/-/g, " "),
        summary: (parsed.summary as string) ?? source.intro.slice(0, 200),
        bodyMd: (parsed.bodyMd as string) ?? content,
      };
    }
  }

  return {
    title: item.slug.replace(/-/g, " "),
    summary: source.intro.slice(0, 200),
    bodyMd: content || source.fullText,
  };
}

// ─── Upsert ─────────────────────────────────────────────────────────

export async function upsertWikiEntry(
  item: WikiManifestItem,
  rewritten: { title: string; summary: string; bodyMd: string },
  source: WikipediaSource,
): Promise<{ id: string } | { error: string }> {
  const client = getAdminClient();
  if (!client) return { error: "SUPABASE_SERVICE_ROLE_KEY 未配置" };

  const { data, error } = await (client as any)
    .from("wiki_entries")
    .upsert(
      {
        slug: item.slug,
        title: rewritten.title,
        category: item.category,
        summary: rewritten.summary,
        body_md: rewritten.bodyMd,
        cover_url: source.coverUrl,
        tags: item.tags ?? [],
        wikipedia_title: item.wikipediaTitle.replace(/%27|_/g, (m) =>
          m === "%27" ? "'" : " ",
        ),
        wikipedia_url: source.pageUrl,
        is_published: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Fire-and-forget: analyze edges for the new entry
  analyzeEdgesForNewEntry(data.id).catch(() => {});

  return { id: data.id };
}

async function analyzeEdgesForNewEntry(entryId: string) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Fetch the new entry
    const { data: entry } = await client
      .from("wiki_entries")
      .select("*")
      .eq("id", entryId)
      .single();

    if (!entry) return;

    // Fetch all other entries
    const { data: existing } = await client
      .from("wiki_entries")
      .select("*")
      .neq("id", entryId)
      .eq("is_published", true);

    if (!existing?.length) return;

    const { analyzeEdges } = await import("./edge-analyzer");
    const edges = await analyzeEdges(entry, existing);

    if (edges.length > 0) {
      await client.from("wiki_edges").upsert(
        edges.map((e) => ({
          source_id: e.sourceId,
          target_id: e.targetId,
          label: e.label,
          strength: e.strength,
        })),
        { onConflict: "source_id,target_id" },
      );
      console.log(`[wiki-ingest] Created ${edges.length} edges for ${entry.title}`);
    }
  } catch (err) {
    console.warn("[wiki-ingest] Edge analysis failed:", err);
  }
}

// ─── Full pipeline ─────────────────────────────────────────────────

export async function ingestEntry(
  item: WikiManifestItem,
  dryRun = false,
): Promise<IngestResult> {
  try {
    console.log(`[wiki-ingest] Fetching: ${item.slug} (${item.wikipediaTitle})`);
    const source = await fetchWikipediaContent(item);

    console.log(`[wiki-ingest] Rewriting: ${item.slug}`);
    const rewritten = await rewriteEntry(item, source);

    if (dryRun) {
      console.log(`[wiki-ingest] DRY RUN — would upsert: ${item.slug}`);
      console.log(`  Title: ${rewritten.title}`);
      console.log(`  Summary: ${rewritten.summary.slice(0, 100)}...`);
      console.log(`  Body length: ${rewritten.bodyMd.length} chars`);
      return { ok: true, slug: item.slug };
    }

    const upsertResult = await upsertWikiEntry(item, rewritten, source);
    if ("error" in upsertResult) {
      return { ok: false, slug: item.slug, error: upsertResult.error };
    }

    console.log(`[wiki-ingest] ✓ ${item.slug} → ${upsertResult.id}`);
    return { ok: true, slug: item.slug, entryId: upsertResult.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[wiki-ingest] ✗ ${item.slug}: ${message}`);
    return { ok: false, slug: item.slug, error: message };
  }
}

export async function ingestAll(dryRun = false): Promise<IngestResult[]> {
  const { WIKI_MANIFEST } = await import("./manifest");
  const results: IngestResult[] = [];

  for (const item of WIKI_MANIFEST) {
    const result = await ingestEntry(item, dryRun);
    results.push(result);
    // Small delay between entries to be polite to Wikipedia API
    if (WIKI_MANIFEST.indexOf(item) < WIKI_MANIFEST.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return results;
}
