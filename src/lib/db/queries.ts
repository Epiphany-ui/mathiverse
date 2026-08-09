import type { Profile, Visualization, Article, Comment, FeedItem, FeedSort } from "@/types";

// Lightweight client interface — both server and browser Supabase clients satisfy this
interface SupabaseQueryClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order?: (column: string, opts?: { ascending?: boolean }) => {
          eq?: (column: string, value: string) => any;
          single?: () => Promise<{ data: any; error: any }>;
        };
        single: () => Promise<{ data: any; error: any }>;
        then?: (resolve: (v: any) => any) => any;
      };
      ilike?: (column: string, pattern: string) => any;
      contains?: (column: string, value: any) => any;
      order: (column: string, opts?: { ascending?: boolean }) => any;
      limit?: (n: number) => any;
      single?: () => Promise<{ data: any; error: any }>;
    };
  };
}

/* ─── Profile ─── */

/** Map Supabase snake_case row → camelCase Profile */
function normProfile(row: Record<string, any>): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName ?? row.display_name ?? "Unknown",
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,
    bio: row.bio ?? row.biography ?? "",
    website: row.website ?? "",
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };
}

export async function getProfile(
  client: any,
  id: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return normProfile(data);
}

export async function getProfileByUsername(
  client: any,
  username: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !data) return null;
  return normProfile(data);
}

/* ─── Normalizers — map Supabase snake_case rows → camelCase types ─── */

function normAuthor(row: Record<string, any>): Pick<Profile, "id" | "username" | "displayName" | "avatarUrl"> | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username ?? row.user_name ?? "unknown",
    displayName: row.displayName ?? row.display_name ?? "Unknown",
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,
  };
}

function normVisualization(row: Record<string, any>): Visualization {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? row.description_ ?? "",
    tags: row.tags ?? [],
    sourceCode: row.sourceCode ?? row.source_code ?? "",
    videoUrl: row.videoUrl ?? row.video_url ?? null,
    gifUrl: row.gifUrl ?? row.gif_url ?? null,
    posterUrl: row.posterUrl ?? row.poster_url ?? null,
    duration: row.duration ?? 0,
    authorId: row.authorId ?? row.author_id ?? "unknown",
    forkedFrom: row.forkedFrom ?? row.forked_from ?? null,
    likesCount: row.likesCount ?? row.likes_count ?? 0,
    commentsCount: row.commentsCount ?? row.comments_count ?? 0,
    forksCount: row.forksCount ?? row.forks_count ?? 0,
    viewsCount: row.viewsCount ?? row.views_count ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    author: row.profiles ? normAuthor(row.profiles) : undefined,
  };
}

function normArticle(row: Record<string, any>): Article {
  return {
    id: row.id,
    title: row.title,
    coverUrl: row.coverUrl ?? row.cover_url ?? null,
    bodyMd: row.bodyMd ?? row.body_md ?? "",
    embeddedViz: row.embeddedViz ?? row.embedded_viz ?? [],
    tags: row.tags ?? [],
    authorId: row.authorId ?? row.author_id ?? "unknown",
    likesCount: row.likesCount ?? row.likes_count ?? 0,
    commentsCount: row.commentsCount ?? row.comments_count ?? 0,
    collectionsCount: row.collectionsCount ?? row.collections_count ?? 0,
    viewsCount: row.viewsCount ?? row.views_count ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    author: row.profiles ? normAuthor(row.profiles) : undefined,
  };
}

function normComment(row: Record<string, any>): Comment {
  return {
    id: row.id,
    body: row.body,
    authorId: row.authorId ?? row.author_id ?? "unknown",
    targetType: row.targetType ?? row.target_type ?? "visualization",
    targetId: row.targetId ?? row.target_id ?? "",
    parentId: row.parentId ?? row.parent_id ?? null,
    likesCount: row.likesCount ?? row.likes_count ?? 0,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    author: row.profiles ? normAuthor(row.profiles) : undefined,
  };
}

/* ─── Visualization ─── */

export async function getVisualizationById(
  client: any,
  id: string,
): Promise<Visualization | null> {
  const { data, error } = await client
    .from("visualizations")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return normVisualization(data);
}

/* ─── Article ─── */

export async function getArticleById(
  client: any,
  id: string,
): Promise<Article | null> {
  const { data, error } = await client
    .from("articles")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return normArticle(data);
}

/* ─── Comments ─── */

export async function getCommentsForTarget(
  client: any,
  targetType: "visualization" | "article",
  targetId: string,
): Promise<Comment[]> {
  const { data, error } = await client
    .from("comments")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const rows: Comment[] = data.map((row: any) => normComment(row));

  // Build reply tree: top-level (no parentId) + nested replies
  const topLevel = rows.filter((c) => !c.parentId);
  const replies = rows.filter((c) => c.parentId);

  return topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentId === c.id),
  }));
}

/* ─── User content ─── */

export async function getUserVisualizations(
  client: any,
  userId: string,
): Promise<Visualization[]> {
  const { data, error } = await client
    .from("visualizations")
    .select("*")
    .eq("author_id", userId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => normVisualization(row));
}

export async function getUserArticles(
  client: any,
  userId: string,
): Promise<Article[]> {
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("author_id", userId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => normArticle(row));
}

/* ─── Feed ─── */

export async function buildFeedItems(
  client: any,
  sort: FeedSort,
): Promise<FeedItem[]> {
  // Fetch visualizations + their authors
  const { data: vizData, error: vizErr } = await client
    .from("visualizations")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("is_published", true);

  // Fetch articles + their authors
  const { data: articleData, error: artErr } = await client
    .from("articles")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("is_published", true);

  if (vizErr && artErr) return [];

  // Normalize joined profile: Supabase may return keys as camelCase or snake_case in nested objects
  function normProfile(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      username: p.username ?? p.user_name ?? "unknown",
      displayName: p.displayName ?? p.display_name ?? "Unknown",
      avatarUrl: p.avatarUrl ?? p.avatar_url ?? null,
    };
  }

  const vizItems: FeedItem[] = (vizData ?? []).map((v: any) => ({
    type: "visualization" as const,
    id: v.id,
    title: v.title,
    description: v.description,
    posterUrl: v.poster_url ?? v.posterUrl ?? null,
    tags: v.tags ?? [],
    author: normProfile(v.profiles) ?? { id: v.authorId ?? v.author_id ?? "unknown", username: "unknown", displayName: "Unknown", avatarUrl: null },
    likesCount: v.likes_count ?? v.likesCount ?? 0,
    commentsCount: v.comments_count ?? v.commentsCount ?? 0,
    createdAt: v.created_at ?? v.createdAt,
  }));

  const articleItems: FeedItem[] = (articleData ?? []).map((a: any) => ({
    type: "article" as const,
    id: a.id,
    title: a.title,
    description: (a.body_md ?? a.bodyMd ?? "").slice(0, 150) + "...",
    coverUrl: a.cover_url ?? a.coverUrl ?? null,
    posterUrl: a.cover_url ?? a.coverUrl ?? null,
    tags: a.tags ?? [],
    author: normProfile(a.profiles) ?? { id: a.authorId ?? a.author_id ?? "unknown", username: "unknown", displayName: "Unknown", avatarUrl: null },
    likesCount: a.likes_count ?? a.likesCount ?? 0,
    commentsCount: a.comments_count ?? a.commentsCount ?? 0,
    createdAt: a.created_at ?? a.createdAt,
  }));

  const all = [...vizItems, ...articleItems];

  if (sort === "new") {
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    // hot: sort by likes + comments
    all.sort((a, b) => (b.likesCount + b.commentsCount * 2) - (a.likesCount + a.commentsCount * 2));
  }

  return all;
}

/* ─── Search ─── */

export async function searchContent(
  client: any,
  query: string,
): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];

  // Search visualizations by title or description
  const { data: vizData } = await client
    .from("visualizations")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("is_published", true)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  // Search articles by title
  const { data: artData } = await client
    .from("articles")
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .eq("is_published", true)
    .or(`title.ilike.%${q}%,body_md.ilike.%${q}%`);

  const results: FeedItem[] = [];

  for (const v of vizData ?? []) {
    const matches =
      (v.title ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (v.description ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (v.tags ?? []).some((t: string) => t.toLowerCase().includes(q.toLowerCase())) ||
      (v.profiles?.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (v.profiles?.username ?? "").toLowerCase().includes(q.toLowerCase());

    if (matches) {
      results.push({
        type: "visualization",
        id: v.id,
        title: v.title,
        description: v.description,
        posterUrl: v.poster_url ?? v.posterUrl ?? null,
        tags: v.tags ?? [],
        author: v.profiles ? { id: v.profiles.id, username: v.profiles.username ?? "unknown", displayName: v.profiles.display_name ?? v.profiles.displayName ?? "Unknown", avatarUrl: v.profiles.avatar_url ?? v.profiles.avatarUrl ?? null } : { id: v.author_id ?? v.authorId ?? "unknown", username: "unknown", displayName: "Unknown", avatarUrl: null },
        likesCount: v.likes_count ?? v.likesCount ?? 0,
        commentsCount: v.comments_count ?? v.commentsCount ?? 0,
        createdAt: v.created_at ?? v.createdAt,
      });
    }
  }

  for (const a of artData ?? []) {
    const matches =
      (a.title ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (a.body_md ?? a.bodyMd ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (a.tags ?? []).some((t: string) => t.toLowerCase().includes(q.toLowerCase())) ||
      (a.profiles?.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (a.profiles?.username ?? "").toLowerCase().includes(q.toLowerCase());

    if (matches) {
      results.push({
        type: "article",
        id: a.id,
        title: a.title,
        description: (a.body_md ?? a.bodyMd ?? "").slice(0, 150) + "...",
        coverUrl: a.cover_url ?? a.coverUrl ?? null,
        posterUrl: a.cover_url ?? a.coverUrl ?? null,
        tags: a.tags ?? [],
        author: a.profiles ? { id: a.profiles.id, username: a.profiles.username ?? "unknown", displayName: a.profiles.display_name ?? a.profiles.displayName ?? "Unknown", avatarUrl: a.profiles.avatar_url ?? a.profiles.avatarUrl ?? null } : { id: a.author_id ?? a.authorId ?? "unknown", username: "unknown", displayName: "Unknown", avatarUrl: null },
        likesCount: a.likes_count ?? a.likesCount ?? 0,
        commentsCount: a.comments_count ?? a.commentsCount ?? 0,
        createdAt: a.created_at ?? a.createdAt,
      });
    }
  }

  return results;
}

/* ─── Filter by tag ─── */

export async function filterByTag(
  client: any,
  tag: string,
): Promise<FeedItem[]> {
  // Build full feed first, then filter by tag client-side
  // (Supabase array-contains can also do this, but PostgREST .contains()
  // with the schema is simpler served as: .contains('tags', [tag]))
  const all = await buildFeedItems(client, "hot");
  return all.filter((item) =>
    item.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );
}
