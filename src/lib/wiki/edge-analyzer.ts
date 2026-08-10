// src/lib/wiki/edge-analyzer.ts
// AI-driven relationship analysis between wiki entries

import { chatCompletion, MODELS } from "@/lib/ai/client";
import type { WikiEntry } from "@/types";

export interface EdgeResult {
  sourceId: string;
  targetId: string;
  label: string;
  strength: number;
}

const ANALYSIS_PROMPT = `你是数学知识图谱专家。分析以下两个数学词条之间的关系。

词条 A: {titleA} — {summaryA}
词条 B: {titleB} — {summaryB}

返回 JSON（只输出 JSON，无额外文字）:
{
  "hasRelation": true,
  "label": "A对B的关系描述，≤15字中文",
  "strength": 0.85
}

关系强度:
0.9+: 直接核心关系
0.7-0.9: 强相关（同一分支）
0.5-0.7: 一般相关
0.3-0.5: 弱相关（跨分支）
<0.3: 无关系（hasRelation=false）`;

/**
 * Analyze relationships between a new entry and all existing entries.
 * Returns edges to create (bidirectional — one edge per direction).
 */
export async function analyzeEdges(
  newEntry: WikiEntry,
  existingEntries: WikiEntry[],
): Promise<EdgeResult[]> {
  const edges: EdgeResult[] = [];

  // Process in batches of 3 to avoid huge prompts
  for (let i = 0; i < existingEntries.length; i += 3) {
    const batch = existingEntries.slice(i, i + 3);

    const batchResults = await Promise.allSettled(
      batch.map((existing) => analyzePair(newEntry, existing)),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        edges.push(...result.value);
      } else {
        console.warn(`[edge-analyzer] Rejected: ${result.reason?.message ?? result.reason}`);
      }
    }
  }

  return edges;
}

async function analyzePair(
  entryA: WikiEntry,
  entryB: WikiEntry,
): Promise<EdgeResult[]> {
  const prompt = ANALYSIS_PROMPT
    .replace("{titleA}", entryA.title)
    .replace("{summaryA}", entryA.summary)
    .replace("{titleB}", entryB.title)
    .replace("{summaryB}", entryB.summary);

  try {
    const response = await chatCompletion({
      messages: [{ role: "user", content: prompt }],
      model: MODELS.metadata,
      thinking: { type: "disabled" },
      temperature: 0.3,
      max_tokens: 200,
    });

    const parsed = parseAnalysisResponse(response);
    if (!parsed) {
      console.warn(`[edge-analyzer] Parse failed for ${entryA.title} ↔ ${entryB.title}: ${response.slice(0, 100)}`);
      return [];
    }
    if (!parsed.hasRelation) return [];

    const edges: EdgeResult[] = [];
    if (parsed.strength >= 0.3) {
      edges.push({
        sourceId: entryA.id,
        targetId: entryB.id,
        label: parsed.label,
        strength: parsed.strength,
      });
    }
    // Add reverse edge if the relationship is bidirectional (default: yes)
    if (parsed.strength >= 0.3) {
      edges.push({
        sourceId: entryB.id,
        targetId: entryA.id,
        label: flipLabel(parsed.label),
        strength: parsed.strength,
      });
    }

    return edges;
  } catch {
    return [];
  }
}

function parseAnalysisResponse(
  response: string,
): { hasRelation: boolean; label: string; strength: number } | null {
  try {
    const json = JSON.parse(response.trim());
    return {
      hasRelation: Boolean(json.hasRelation),
      label: String(json.label ?? "").slice(0, 15),
      strength: Math.min(1, Math.max(0, Number(json.strength) || 0.5)),
    };
  } catch {
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const json = JSON.parse(match[0]);
      return {
        hasRelation: Boolean(json.hasRelation),
        label: String(json.label ?? "").slice(0, 15),
        strength: Math.min(1, Math.max(0, Number(json.strength) || 0.5)),
      };
    } catch {
      return null;
    }
  }
}

/** Flip a directional label for the reverse edge. */
function flipLabel(label: string): string {
  return label
    .replace(/^属于/, "包含")
    .replace(/^包含/, "属于")
    .replace(/^推广/, "特例")
    .replace(/^特例/, "推广")
    .replace(/^应用于/, "被应用于")
    .replace(/^被应用于/, "应用于")
    .replace(/^证明/, "被证明")
    .replace(/^被证明/, "证明")
    .replace(/^推导/, "被推导")
    .replace(/^关联$/, "关联");
}
