import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  tag: string;
  clickable?: boolean;
  active?: boolean;
  className?: string;
  /** In-page selection handler — renders a real button instead of a Link. */
  onSelect?: () => void;
}

export function TagBadge({
  tag,
  clickable = true,
  active,
  className,
  onSelect,
}: TagBadgeProps) {
  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-normal transition-colors",
        clickable && "hover:bg-primary/10 hover:text-primary cursor-pointer",
        active &&
          "bg-primary/20 border-primary/50 text-primary hover:bg-primary/20",
        className,
      )}
    >
      {tag}
    </Badge>
  );

  if (clickable && onSelect) {
    return (
      <button type="button" onClick={onSelect} className="inline-flex">
        {badge}
      </button>
    );
  }

  if (clickable) {
    return (
      <Link href={`/search?q=${encodeURIComponent(tag)}`}>{badge}</Link>
    );
  }

  return badge;
}
