#!/usr/bin/env npx tsx
// scripts/seed-examples.ts
// Seed the manim_examples vector store with initial examples.
// Usage: npx tsx scripts/seed-examples.ts
//
// Loads .env.local for SUPABASE_SERVICE_ROLE_KEY and other secrets.

import { readFileSync } from "fs";
import { resolve } from "path";

// Manually load .env.local (avoids adding a dotenv dependency)
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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.warn("[seed] Could not load .env.local — using existing env vars");
  }
}
loadEnvLocal();

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

// ─── Source 2: Manim official gallery ───

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

        const lines = code.split("\n").length;
        const difficulty = lines < 50 ? 1 : lines < 80 ? 2 : 3;
        const className =
          code.match(/class\s+(\w+)\s*\(/)?.[1] ?? "Unknown";

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
    console.error(
      "[seed] Ollama is not running. Start it with: ollama serve",
    );
    process.exit(1);
  }

  const existing = await countExamples();
  if (existing > 0) {
    console.log(
      `[seed] ${existing} examples already exist. Delete rows to re-seed.`,
    );
    process.exit(0);
  }

  console.log("[seed] Collecting examples...");
  const existingExamples = extractExistingExamples();
  const galleryExamples = await fetchManimGallery();
  const allExamples = [...existingExamples, ...galleryExamples];

  console.log(
    `[seed] Got ${existingExamples.length} existing + ${galleryExamples.length} gallery = ${allExamples.length} total`,
  );

  let inserted = 0;
  for (const ex of allExamples) {
    // Generate AI metadata for gallery examples
    let title = ex.title;
    let description = ex.description;
    if (ex.source === "manim-gallery") {
      try {
        const meta = await generateMetadata(
          ex.code.slice(0, 200),
          ex.code,
        );
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

  console.log(
    `\n[seed] Done. Inserted ${inserted}/${allExamples.length} examples.`,
  );
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
