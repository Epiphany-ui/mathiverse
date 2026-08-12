"use client";

import { useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Notification,
  getNotificationMessage,
} from "@/lib/db/notifications";

interface NotificationDropdownProps {
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
  className?: string;
}

/** Relative time helper — lightweight, no i18n library needed */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function NotificationDropdown({
  unreadCount,
  onUnreadCountChange,
  className,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Silently degrade — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        fetchNotifications();
      }
    },
    [fetchNotifications],
  );

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        onUnreadCountChange(Math.max(0, unreadCount - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // Silently degrade
      }
    },
    [unreadCount, onUnreadCountChange],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      onUnreadCountChange(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Silently degrade
    }
  }, [onUnreadCountChange]);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
          className={cn(
            "relative h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent hover:text-accent-foreground",
            className,
          )}
          aria-label="通知"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#c64545] text-white text-[10px] font-bold flex items-center justify-center animate-heart-burst">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">通知</span>
          {notifications.some((n) => !n.isRead) && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              全部已读
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty */}
        {!loading && notifications.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            暂无通知
          </div>
        )}

        {/* Notification list */}
        {!loading &&
          notifications.map((n) => {
            const { message, href } = getNotificationMessage(n);
            return (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                onClick={async () => {
                  if (!n.isRead) await markAsRead(n.id);
                  window.location.href = href;
                }}
              >
                {/* Actor avatar */}
                <Avatar className="w-8 h-8 shrink-0">
                  {n.actor?.avatarUrl ? (
                    <AvatarImage
                      src={n.actor.avatarUrl}
                      alt={n.actor.displayName ?? ""}
                    />
                  ) : null}
                  <AvatarFallback className="text-xs bg-[#cc785c] text-white">
                    {(n.actor?.displayName ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug truncate">{message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {relativeTime(n.createdAt)}
                  </p>
                </div>

                {/* Unread dot */}
                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-[#cc785c] shrink-0 mt-1.5" />
                )}
              </DropdownMenuItem>
            );
          })}

        {/* Footer */}
        {!loading && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-xs text-muted-foreground"
              onClick={() => {
                window.location.href = "/settings/notifications";
              }}
            >
              查看全部
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
