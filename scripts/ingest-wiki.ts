#!/usr/bin/env npx tsx
/**
 * Wikipedia ingestion script for Mathiverse wiki.
 *
 * Usage:
 *   npx tsx scripts/ingest-wiki.ts                      # ingest entire manifest
 *   npx tsx scripts/ingest-wiki.ts --slug=fourier-series  # single entry
 *   npx tsx scripts/ingest-wiki.ts --dry-run             # fetch + rewrite, no DB write
 *   npx tsx scripts/ingest-wiki.ts --list                # list all manifest entries
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Manually load .env.local (same pattern as seed-examples.ts)
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
    console.warn("[wiki-ingest] Could not load .env.local");
  }
}
loadEnvLocal();

// Dynamic imports after env is loaded
async function main() {
  const { WIKI_MANIFEST } = await import("../src/lib/wiki/manifest");
  const { ingestEntry, ingestAll } = await import("../src/lib/wiki/ingest");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const listOnly = args.includes("--list");
  const slugIdx = args.indexOf("--slug");
  const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;

  if (listOnly) {
    console.log(`Manifest entries (${WIKI_MANIFEST.length}):\n`);
    for (const item of WIKI_MANIFEST) {
      console.log(`  [${item.category}] ${item.slug} ← ${item.wikipediaTitle}`);
    }
    process.exit(0);
  }

  if (targetSlug) {
    const item = WIKI_MANIFEST.find((i) => i.slug === targetSlug);
    if (!item) {
      console.error(`Entry not found in manifest: ${targetSlug}`);
      process.exit(1);
    }
    console.log(`Ingesting single entry: ${item.slug}\n`);
    const result = await ingestEntry(item, dryRun);
    console.log(`\nResult: ${result.ok ? "✓ OK" : "✗ FAILED"}`);
    if (result.error) console.log(`Error: ${result.error}`);
    process.exit(result.ok ? 0 : 1);
  }

  console.log(`Ingesting ${WIKI_MANIFEST.length} entries${dryRun ? " (DRY RUN)" : ""}\n`);
  const results = await ingestAll(dryRun);

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nDone: ${ok} OK, ${failed} failed, ${results.length} total`);

  for (const r of results) {
    if (!r.ok) console.log(`  ✗ ${r.slug}: ${r.error}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
