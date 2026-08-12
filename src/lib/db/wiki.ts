import type { WikiEntry, WikiCategory } from "@/types";
import { normAuthor } from "./queries";
import { withTimeout } from "@/lib/supabase/with-timeout";

export async function createWikiEntry(
  client: any,
  input: { slug: string; title: string; category: string; summary: string; bodyMd: string; authorId: string },
): Promise<WikiEntry> {
  const { data, error } = await client
    .from("wiki_entries")
    .insert({
      slug: input.slug,
      title: input.title,
      category: input.category,
      summary: input.summary,
      body_md: input.bodyMd,
      author_id: input.authorId,
      is_published: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normWikiEntry(data);
}

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
    authorId: row.authorId ?? row.author_id ?? null,
    likesCount: row.likesCount ?? row.likes_count ?? 0,
    commentsCount: row.commentsCount ?? row.comments_count ?? 0,
    viewsCount: row.viewsCount ?? row.views_count ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    author: row.profiles ? normAuthor(row.profiles) : undefined,
  };
}

export async function getWikiEntryBySlug(
  client: any,
  slug: string,
  opts?: { includeUnpublished?: boolean; adminClient?: any },
): Promise<WikiEntry | null> {
  // When including unpublished, use admin client to bypass RLS
  // (RLS policy "wiki_read_published" blocks reads on is_published=false)
  const queryClient = opts?.includeUnpublished && opts?.adminClient ? opts.adminClient : client;
  let query = queryClient.from("wiki_entries").select("*").eq("slug", slug);
  if (!opts?.includeUnpublished) query = query.eq("is_published", true);
  const { data, error } = await withTimeout(query).single();

  if (error || !data) return null;
  const entry = normWikiEntry(data);

  // Fetch author separately — profiles!author_id embed is an inner join
  // that drops entries with NULL author_id (all seed/ingest entries).
  if (entry.authorId) {
    const { data: profile } = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", entry.authorId)
      .maybeSingle();
    if (profile) entry.author = normAuthor(profile);
  }
  return entry;
}

export async function getWikiEntryById(
  client: any,
  id: string,
  opts?: { includeUnpublished?: boolean; adminClient?: any },
): Promise<WikiEntry | null> {
  // When including unpublished, use admin client to bypass RLS
  const queryClient = opts?.includeUnpublished && opts?.adminClient ? opts.adminClient : client;
  let query = queryClient.from("wiki_entries").select("*").eq("id", id);
  if (!opts?.includeUnpublished) query = query.eq("is_published", true);
  const { data, error } = await withTimeout(query).single();

  if (error || !data) return null;
  const entry = normWikiEntry(data);
  if (entry.authorId) {
    const { data: profile } = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", entry.authorId)
      .maybeSingle();
    if (profile) entry.author = normAuthor(profile);
  }
  return entry;
}

/** Batch-fetch authors for a list of entries that have authorId set. */
async function hydrateAuthors(client: any, entries: WikiEntry[]): Promise<void> {
  const authorIds = [...new Set(entries.map((e) => e.authorId).filter(Boolean))] as string[];
  if (authorIds.length === 0) return;
  const { data: profiles } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds);
  if (!profiles) return;
  const byId = new Map((profiles as any[]).map((p: any) => [p.id, p]));
  for (const entry of entries) {
    if (entry.authorId) entry.author = normAuthor(byId.get(entry.authorId));
  }
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
  const entries = data.map((row: any) => normWikiEntry(row));
  await hydrateAuthors(client, entries);
  return entries;
}

/** Lightweight listing — excludes the heavy body_md column. */
export async function getAllWikiEntriesForListing(
  client: any,
): Promise<WikiEntry[]> {
  const { data, error } = await withTimeout(
    client
      .from("wiki_entries")
      .select("id, slug, title, category, summary, cover_url, tags, author_id, likes_count, comments_count, views_count, is_published, created_at, updated_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  );

  if (error || !data) return [];
  const entries = data.map((row: any) => normWikiEntry(row));
  await hydrateAuthors(client, entries);
  return entries;
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
  const entries = data.map((row: any) => normWikiEntry(row));
  await hydrateAuthors(client, entries);
  return entries;
}

export async function searchWikiEntries(
  client: any,
  query: string,
): Promise<WikiEntry[]> {
  const q = query.trim();
  if (!q) return [];

  // Strip .or() grammar chars (`,`, `(`, `)`) so the filter parses; escape
  // LIKE wildcards (`%`, `_`) so they match literally (math notation like
  // R_0, a_n); double single quotes for PostgREST.
  const qSafe = q
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/[,()]/g, "");

  const { data, error } = await client
    .from("wiki_entries")
    .select("*")
    .eq("is_published", true)
    .or(`title.ilike.%${qSafe}%,summary.ilike.%${qSafe}%`);

  if (error || !data) return [];
  const entries = data.map((row: any) => normWikiEntry(row));
  await hydrateAuthors(client, entries);
  return entries;
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

/** Get all entries connected to the given entry (up to 2 hops).
 *  Uses batch queries instead of N+1 individual edge fetches. */
export async function getConnectedEntries(
  client: any,
  entryId: string,
): Promise<{ entries: WikiEntry[]; edges: WikiEdge[]; allIds: Set<string> }> {
  // First hop: edges directly connected to entryId
  const directEdges = await getEdgesForEntry(client, entryId);

  // Fallback: if no edges exist, generate from shared tags
  if (directEdges.length === 0) {
    return getTagBasedConnections(client, entryId);
  }

  const directIds = directEdges.map((e) =>
    e.sourceId === entryId ? e.targetId : e.sourceId,
  );

  // Second hop: batch-query ALL edges for the connected entries in one round trip.
  // Query edges where source_id or target_id is any of the directIds.
  const hopIds = directIds.slice(0, 8);
  const [sourceRes, targetRes] = await Promise.all([
    client.from("wiki_edges").select("*").in("source_id", hopIds),
    client.from("wiki_edges").select("*").in("target_id", hopIds),
  ]);

  const secondEdges: WikiEdge[] = [
    ...(sourceRes.data ?? []).map((row: any) => normEdge(row)),
    ...(targetRes.data ?? []).map((row: any) => normEdge(row)),
  ];

  const allEdges = [...directEdges, ...secondEdges];
  const allIds = new Set<string>();
  allIds.add(entryId);
  for (const e of allEdges) {
    allIds.add(e.sourceId);
    allIds.add(e.targetId);
  }

  const entries = await getWikiEntriesByIds(client, [...allIds]);

  return { entries, edges: allEdges, allIds };
}

/** Fallback: build edges from tag overlap when wiki_edges is empty. */
async function getTagBasedConnections(
  client: any,
  entryId: string,
): Promise<{ entries: WikiEntry[]; edges: WikiEdge[]; allIds: Set<string> }> {
  const current = await getWikiEntryById(client, entryId);
  if (!current) return { entries: [], edges: [], allIds: new Set() };

  const allEntries = await getAllWikiEntriesForListing(client);
  const currentTags = new Set(current.tags ?? []);

  const edges: WikiEdge[] = [];
  const connectedIds = new Set<string>();
  connectedIds.add(entryId);

  for (const entry of allEntries) {
    if (entry.id === entryId) continue;
    const overlap = (entry.tags ?? []).filter((t) => currentTags.has(t));
    if (overlap.length > 0) {
      const strength = Math.min(0.9, 0.3 + overlap.length * 0.2);
      edges.push({
        id: `tag-${entryId}-${entry.id}`,
        sourceId: entryId,
        targetId: entry.id,
        label: overlap.slice(0, 2).join("、"),
        strength,
      });
      edges.push({
        id: `tag-${entry.id}-${entryId}`,
        sourceId: entry.id,
        targetId: entryId,
        label: overlap.slice(0, 2).join("、"),
        strength,
      });
      connectedIds.add(entry.id);
    }
  }

  const entries = allEntries.filter((e) => connectedIds.has(e.id));
  return { entries, edges, allIds: connectedIds };
}
