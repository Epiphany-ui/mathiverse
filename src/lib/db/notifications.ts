/**
 * Notification queries for the Mathiverse notification system.
 */

export interface Notification {
  id: string;
  userId: string;
  type: "like" | "comment" | "follow" | "fork";
  actorId: string;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
  // Joined
  actor?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/** Map Supabase row to Notification */
function normNotification(row: Record<string, any>): Notification {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    type: row.type,
    actorId: row.actor_id ?? row.actorId,
    targetType: row.target_type ?? row.targetType ?? null,
    targetId: row.target_id ?? row.targetId ?? null,
    isRead: row.is_read ?? row.isRead ?? false,
    createdAt: row.created_at ?? row.createdAt,
    actor: row.actor
      ? {
          id: row.actor.id,
          username: row.actor.username,
          displayName: row.actor.display_name ?? row.actor.displayName,
          avatarUrl: row.actor.avatar_url ?? row.actor.avatarUrl ?? null,
        }
      : undefined,
  };
}

/** Get notifications for the current user, newest first */
export async function getNotifications(
  client: any,
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("*, actor:actor_id(id, username, display_name, avatar_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: any) => normNotification({ ...row, actor: row.actor }));
}

/** Count unread notifications */
export async function getUnreadCount(
  client: any,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error || count === null) return 0;
  return count;
}

/** Mark a notification as read.  Scoped to the owner as defense in depth
 *  (RLS already restricts updates to the current user). */
export async function markAsRead(
  client: any,
  userId: string,
  notificationId: string,
): Promise<void> {
  await client
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

/** Mark all notifications as read for a user */
export async function markAllAsRead(
  client: any,
  userId: string,
): Promise<void> {
  await client
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

/** Build a human-readable notification message */
export function getNotificationMessage(
  notification: Notification,
): { message: string; href: string } {
  const name = notification.actor?.displayName ?? "有人";

  const targetPath =
    notification.targetType === "article" ? "/a/"
    : notification.targetType === "wiki" ? "/wiki/"
    : "/v/";

  switch (notification.type) {
    case "like":
      return {
        message: `${name} 赞了你的${notification.targetType === "comment" ? "评论" : "作品"}`,
        href: notification.targetId && notification.targetType !== "comment"
          ? `${targetPath}${notification.targetId}`
          : notification.targetId
            ? `/v/${notification.targetId}` // fallback for comment likes
            : "#",
      };
    case "comment":
      return {
        message: `${name} 评论了你的${notification.targetType === "article" ? "文章" : notification.targetType === "wiki" ? "词条" : "作品"}`,
        href: notification.targetId ? `${targetPath}${notification.targetId}` : "#",
      };
    case "follow":
      return {
        message: `${name} 关注了你`,
        href: notification.actor?.username
          ? `/u/${notification.actor.username}`
          : "#",
      };
    case "fork":
      return {
        message: `${name} Fork 了你的作品`,
        href: notification.targetId ? `/v/${notification.targetId}` : "#",
      };
  }
}
