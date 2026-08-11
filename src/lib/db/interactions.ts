/**
 * Social interaction helpers — like, bookmark, follow, comment.
 *
 * These are designed for use in client components. Each function
 * expects a Supabase browser client and handles auth internally.
 */

export interface SupabaseBrowserClient {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: any;
    }>;
  };
  from: (table: string) => any;
  rpc: (fn: string, params: any) => any;
}

/* ─── Likes ─── */

export async function getLikeState(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const { data } = await client
    .from("likes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  return !!data;
}

export async function addLike(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ error?: string }> {
  const { error } = await client
    .from("likes")
    .insert({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });

  // PK violation = already liked, not a real error
  if (error && error.code === "23505") return {};
  if (error) return { error: error.message };
  return {};
}

export async function removeLike(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ error?: string }> {
  const { error } = await client
    .from("likes")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) return { error: error.message };
  return {};
}

/* ─── Bookmarks ─── */

export async function getBookmarkState(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const { data } = await client
    .from("bookmarks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  return !!data;
}

export async function addBookmark(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ error?: string }> {
  const { error } = await client
    .from("bookmarks")
    .insert({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });

  if (error && error.code === "23505") return {};
  if (error) return { error: error.message };
  return {};
}

export async function removeBookmark(
  client: SupabaseBrowserClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<{ error?: string }> {
  const { error } = await client
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) return { error: error.message };
  return {};
}

/* ─── Follows ─── */

export async function getFollowState(
  client: SupabaseBrowserClient,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data } = await client
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  return !!data;
}

export async function toggleFollow(
  client: SupabaseBrowserClient,
  followerId: string,
  followingId: string,
  currentlyFollowing: boolean,
): Promise<{ following: boolean; error?: string }> {
  if (currentlyFollowing) {
    const { error } = await client
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);

    if (error) return { following: true, error: error.message };
    return { following: false };
  } else {
    const { error } = await client
      .from("follows")
      .insert({
        follower_id: followerId,
        following_id: followingId,
      });

    if (error && error.code === "23505") return { following: true };
    if (error) return { following: false, error: error.message };
    return { following: true };
  }
}

/* ─── Comments ─── */

export async function addComment(
  client: SupabaseBrowserClient,
  params: {
    body: string;
    authorId: string;
    targetType: "visualization" | "article" | "wiki";
    targetId: string;
    parentId?: string | null;
  },
) {
  const { data, error } = await client
    .from("comments")
    .insert({
      body: params.body,
      author_id: params.authorId,
      target_type: params.targetType,
      target_id: params.targetId,
      parent_id: params.parentId ?? null,
    })
    .select("*, profiles!author_id(id, username, display_name, avatar_url)")
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/* ─── Views ─── */

export async function incrementViews(
  client: SupabaseBrowserClient,
  targetType: "visualization" | "article",
  targetId: string,
): Promise<void> {
  try {
    await client.rpc("increment_views", {
      target_type: targetType,
      target_id: targetId,
    });
  } catch {
    // Fire-and-forget: view counting is non-critical
  }
}
