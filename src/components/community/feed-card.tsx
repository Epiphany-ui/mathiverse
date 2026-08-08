"use client";

import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageCircle,
  Eye,
  Play,
  FileText,
  Clock,
} from "lucide-react";
import type { FeedItem } from "@/types";
import { cn } from "@/lib/utils";

interface FeedCardProps {
  item: FeedItem;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export function FeedCard({ item, className }: FeedCardProps) {
  const href =
    item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
  const isViz = item.type === "visualization";

  return (
    <Link href={href}>
      <GlassCard
        className={cn(
          "overflow-hidden group cursor-pointer h-full flex flex-col",
          className,
        )}
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 relative overflow-hidden">
          {/* Gradient pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(124,58,237,0.3),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.2),transparent_70%)]" />
          </div>

          {/* Play / Doc icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isViz ? (
              <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/60 transition-all">
                <Play className="w-6 h-6 text-white ml-0.5" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-accent/60 transition-all">
                <FileText className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Type badge */}
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 text-xs bg-black/50 backdrop-blur-sm border-0"
          >
            {isViz ? "可视化" : "文章"}
          </Badge>

          {/* Duration for viz */}
          {isViz && (
            <span className="absolute bottom-3 right-3 text-xs text-white/70 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
              <Clock className="w-3 h-3 inline mr-1" />
              观看
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4 flex flex-col flex-1 space-y-3">
          {/* Title */}
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          <div className="flex-1" />

          {/* Author + Stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary/50 to-secondary/50">
                {item.author.displayName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[80px]">
              {item.author.displayName}
            </span>
            <span className="ml-auto flex items-center gap-0.5">
              <Heart className="w-3 h-3" />
              {item.likesCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" />
              {item.commentsCount}
            </span>
          </div>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Time */}
          <span className="text-[10px] text-muted-foreground/60">
            {timeAgo(item.createdAt)}
          </span>
        </div>
      </GlassCard>
    </Link>
  );
}
