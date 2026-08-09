import { FeedCard } from "./feed-card";
import type { FeedItem } from "@/types";

interface FeedGridProps {
  items: FeedItem[];
}

export function FeedGrid({ items }: FeedGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">暂无内容</p>
        <p className="text-muted-foreground/60 text-sm mt-1">
          成为第一个发布可视化作品的人吧！
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item, i) => (
        <FeedCard
          key={`${item.type}-${item.id}`}
          item={item}
          className={`animate-card-enter stagger-${Math.min(i + 1, 9)}`}
        />
      ))}
    </div>
  );
}
