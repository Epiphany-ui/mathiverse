"use client";

import Link from "next/link";
import { TiltCard } from "@/components/shared/tilt-card";
import { GenerativeThumbnail } from "@/components/content/generative-thumbnail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  MessageCircle,
  Play,
  FileText,
} from "lucide-react";
import type { FeedItem } from "@/types";
import { cn } from "@/lib/utils";

interface FeedCardProps {
  item: FeedItem;
  className?: string;
}

// Pastel card tints per domain — echoes Notion's card-tint system
const CARD_TINTS: Record<string, string> = {
  "微积分": "rgba(255,232,212,0.4)",
  "导数": "rgba(255,232,212,0.4)",
  "积分": "rgba(255,232,212,0.4)",
  "极限": "rgba(255,232,212,0.4)",
  "几何": "rgba(217,243,225,0.4)",
  "图形": "rgba(217,243,225,0.4)",
  "拓扑": "rgba(217,243,225,0.4)",
  "代数": "rgba(230,224,245,0.4)",
  "线性代数": "rgba(230,224,245,0.4)",
  "矩阵": "rgba(230,224,245,0.4)",
  "椭圆曲线": "rgba(230,224,245,0.4)",
  "概率": "rgba(220,236,250,0.4)",
  "统计": "rgba(220,236,250,0.4)",
  "正态分布": "rgba(220,236,250,0.4)",
  "傅里叶": "rgba(253,224,236,0.4)",
  "信号处理": "rgba(253,224,236,0.4)",
  "级数": "rgba(253,224,236,0.4)",
  "密码学": "rgba(248,245,232,0.5)",
  "机器学习": "rgba(255,232,212,0.4)",
  "计算机科学": "rgba(230,224,245,0.4)",
};

function cardTint(tags: string[]): string {
  for (const tag of tags) {
    for (const [keyword, tint] of Object.entries(CARD_TINTS)) {
      if (tag.includes(keyword)) return tint;
    }
  }
  return "rgba(255,232,212,0.3)"; // default warm peach
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
  const href = item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
  const isViz = item.type === "visualization";

  if (isViz) {
    return <VizCard item={item} href={href} className={className} />;
  }
  return <ArticleCard item={item} href={href} className={className} />;
}

/* ─── Visualization Card ─── */

function VizCard({ item, href, className }: { item: FeedItem; href: string; className?: string }) {
  const tint = cardTint(item.tags);

  return (
    <Link href={href} className="block group">
      <TiltCard maxTilt={4}>
        <div
          className={cn(
            "overflow-hidden h-full flex flex-col rounded-xl border border-[#e6dfd8] transition-all duration-300",
            "group-hover:-translate-y-1 group-hover:shadow-lg",
            className,
          )}
          style={{ backgroundColor: tint }}
        >
          {/* Thumbnail */}
          <div className="relative aspect-[16/10] rounded-t-xl overflow-hidden">
            <GenerativeThumbnail tags={item.tags} className="absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-white transition-all duration-300 group-hover:shadow-xl">
                <Play className="w-6 h-6 text-[#141413] ml-1" />
              </div>
            </div>
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide uppercase bg-[#141413]/70 backdrop-blur-sm text-white">
              可视化
            </span>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white text-base font-semibold leading-snug line-clamp-2 drop-shadow-md">
                {item.title}
              </h3>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex items-center gap-2 text-xs text-[#6c6a64]">
            <Avatar className="w-5 h-5 ring-1 ring-white">
              {item.author?.avatarUrl ? (
                <AvatarImage src={item.author.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-[10px] bg-[#cc785c] text-white">
                {item.author?.displayName?.slice(0, 1) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-[#3d3d3a]">
              {item.author?.displayName ?? "Unknown"}
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" /> {item.likesCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> {item.commentsCount}
              </span>
            </span>
          </div>
        </div>
      </TiltCard>
    </Link>
  );
}

/* ─── Article Card — magazine layout ─── */

function ArticleCard({ item, href, className }: { item: FeedItem; href: string; className?: string }) {
  const tint = cardTint(item.tags);

  return (
    <Link href={href} className="block group">
      <TiltCard maxTilt={3}>
        <div
          className={cn(
            "overflow-hidden h-full flex flex-row rounded-xl border border-[#e6dfd8] transition-all duration-300",
            "group-hover:-translate-y-1 group-hover:shadow-lg",
            className,
          )}
          style={{ backgroundColor: tint }}
        >
          <div className="flex-1 p-5 flex flex-col min-w-0">
            <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#5db8a6] bg-[#5db8a6]/8 mb-3">
              <FileText className="w-3 h-3" />
              文章
            </span>
            <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-normal leading-snug tracking-[-0.3px] text-[#141413] line-clamp-2 group-hover:text-[#cc785c] transition-colors">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-2 text-xs text-[#6c6a64] leading-relaxed line-clamp-3">
                {item.description}
              </p>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-xs text-[#6c6a64] mt-3 pt-3 border-t border-[#e6dfd8]/50">
              <Avatar className="w-5 h-5">
                {item.author?.avatarUrl ? (
                  <AvatarImage src={item.author.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px] bg-[#181715] text-white">
                  {item.author?.displayName?.slice(0, 1) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium text-[#3d3d3a]">
                {item.author?.displayName ?? "Unknown"}
              </span>
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {item.likesCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {item.commentsCount}
                </span>
              </span>
            </div>
          </div>
          <div className="w-32 shrink-0 relative overflow-hidden border-l border-[#e6dfd8]/50">
            <GenerativeThumbnail tags={item.tags} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#efe9de]/40 pointer-events-none" />
          </div>
        </div>
      </TiltCard>
    </Link>
  );
}
