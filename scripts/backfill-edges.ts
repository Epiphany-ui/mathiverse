#!/usr/bin/env npx tsx
/**
 * Backfill wiki_edges for existing wiki entries.
 * Usage: npx tsx scripts/backfill-edges.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
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
  } catch { /* ok */ }
}
loadEnvLocal();

import { createClient } from "@supabase/supabase-js";
import { analyzeEdges } from "../src/lib/wiki/edge-analyzer";
import type { WikiEntry } from "../src/types";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[backfill] Missing Supabase env vars");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey);

  // Fetch all published wiki entries
  const { data: entries, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("is_published", true);

  if (error || !entries) {
    console.error("[backfill] Failed to fetch entries:", error);
    process.exit(1);
  }

  const wikiEntries = entries.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    summary: r.summary ?? "",
    bodyMd: "",
    coverUrl: null,
    tags: r.tags ?? [],
    wikipediaTitle: null,
    wikipediaUrl: null,
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    isPublished: true,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })) as WikiEntry[];

  console.log(`[backfill] Found ${wikiEntries.length} entries`);

  // Process each entry against all others (only process new entries without edges)
  let totalEdges = 0;
  for (let i = 0; i < wikiEntries.length; i++) {
    const entry = wikiEntries[i];

    // Check if this entry already has edges
    const { count } = await client
      .from("wiki_edges")
      .select("*", { count: "exact", head: true })
      .or(`source_id.eq.${entry.id},target_id.eq.${entry.id}`);

    if (count && count > 0) {
      console.log(`[backfill] [${i + 1}/${wikiEntries.length}] ${entry.title} — already has ${count} edges, skipping`);
      continue;
    }

    const others = wikiEntries.filter((e) => e.id !== entry.id);
    console.log(`[backfill] [${i + 1}/${wikiEntries.length}] ${entry.title} — analyzing ${others.length} potential connections...`);

    const edges = await analyzeEdges(entry, others);

    if (edges.length > 0) {
      const { error: insertErr } = await client.from("wiki_edges").upsert(
        edges.map((e) => ({
          source_id: e.sourceId,
          target_id: e.targetId,
          label: e.label,
          strength: e.strength,
        })),
        { onConflict: "source_id,target_id" },
      );

      if (insertErr) {
        console.error(`  ✗ Insert error:`, insertErr.message);
      } else {
        console.log(`  ✓ Created ${edges.length} edges`);
        totalEdges += edges.length;
      }
    } else {
      console.log(`  - No relations found`);
    }

    // Rate limit: 500ms between entries to avoid hammering the API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n[backfill] Done. Created ${totalEdges} total edges.`);
}

main().catch((err) => {
  console.error("[backfill] Fatal:", err);
  process.exit(1);
});
