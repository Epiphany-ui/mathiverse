import type { WikiEntry, WikiCategory } from "@/types";

function normWikiEntry(row: Record<string, any>): WikiEntry {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category as WikiCategory,
    summary: row.summary ?? "",
    bodyMd: row.bodyMd ?? row.body_md ?? "",
    coverUrl: row.coverUrl ?? row.cover_url ?? null,
    tags: row.tags ?? [],
    wikipediaTitle: row.wikipediaTitle ?? row.wikipedia_title ?? null,
    wikipediaUrl: row.wikipediaUrl ?? row.wikipedia_url ?? null,
    likesCount: row.likesCount ?? row.likes_count ?? 0,
    commentsCount: row.commentsCount ?? row.comments_count ?? 0,
    viewsCount: row.viewsCount ?? row.views_count ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };
}

export async function getWikiEntryBySlug(
  client: any,
  slug: string,
): Promise<WikiEntry | null> {
  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !data) return null;
  return normWikiEntry(data);
}

export async function getWikiEntryById(
  client: any,
  id: string,
): Promise<WikiEntry | null> {
  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !data) return null;
  return normWikiEntry(data);
}

export async function getAllWikiEntries(
  client: any,
): Promise<WikiEntry[]> {
  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => normWikiEntry(row));
}

export async function getWikiEntriesByCategory(
  client: any,
  category: WikiCategory,
): Promise<WikiEntry[]> {
  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("category", category)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => normWikiEntry(row));
}

export async function searchWikiEntries(
  client: any,
  query: string,
): Promise<WikiEntry[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("is_published", true)
    .or(`title.ilike.%${q}%,summary.ilike.%${q}%`);

  if (error || !data) return [];
  return data.map((row: any) => normWikiEntry(row));
}

export async function getWikiEntriesByIds(
  client: any,
  ids: string[],
): Promise<WikiEntry[]> {
  if (!ids.length) return [];
  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .in("id", ids)
    .eq("is_published", true);

  if (error || !data) return [];
  return data.map((row: any) => normWikiEntry(row));
}

/* ─── Knowledge Graph Edges ─── */

export interface WikiEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  strength: number;
}

function normEdge(row: Record<string, any>): WikiEdge {
  return {
    id: row.id,
    sourceId: row.sourceId ?? row.source_id,
    targetId: row.targetId ?? row.target_id,
    label: row.label ?? "",
    strength: row.strength ?? 0.5,
  };
}

/** Get all edges for a wiki entry (both inbound and outbound). */
export async function getEdgesForEntry(
  client: any,
  entryId: string,
): Promise<WikiEdge[]> {
  const { data, error } = await client
    .from("wiki_edges")
    .select("*")
    .or(`source_id.eq.${entryId},target_id.eq.${entryId}`);

  if (error || !data) return [];
  return data.map((row: any) => normEdge(row));
}

/** Insert edges in batch. */
export async function insertEdges(
  client: any,
  edges: { sourceId: string; targetId: string; label: string; strength: number }[],
): Promise<number> {
  if (!edges.length) return 0;

  const { error } = await client.from("wiki_edges").upsert(
    edges.map((e) => ({
      source_id: e.sourceId,
      target_id: e.targetId,
      label: e.label,
      strength: e.strength,
    })),
    { onConflict: "source_id,target_id" },
  );

  if (error) {
    console.warn("[wiki] Edge insert error:", error.message);
    return 0;
  }
  return edges.length;
}

/** Get all entries connected to the given entry (up to 2 hops). */
export async function getConnectedEntries(
  client: any,
  entryId: string,
): Promise<{ entries: WikiEntry[]; edges: WikiEdge[]; allIds: Set<string> }> {
  // First hop: direct edges
  const directEdges = await getEdgesForEntry(client, entryId);
  const directIds = directEdges.map((e) =>
    e.sourceId === entryId ? e.targetId : e.sourceId,
  );

  // Second hop: edges of connected entries
  const secondEdges: WikiEdge[] = [];
  for (const id of directIds.slice(0, 8)) {
    const es = await getEdgesForEntry(client, id);
    secondEdges.push(...es);
  }

  const allEdges = [...directEdges, ...secondEdges];
  const allIds = new Set<string>();
  allIds.add(entryId);
  for (const e of allEdges) {
    allIds.add(e.sourceId);
    allIds.add(e.targetId);
  }

  // Fetch all entries
  const entries = await getWikiEntriesByIds(client, [...allIds]);

  return { entries, edges: allEdges, allIds };
}
