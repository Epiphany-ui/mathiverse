import type { FeedItem } from "@/types";
import { isLocalRendererUrl } from "@/lib/utils";

function isValidVideoUrl(url: string | null | undefined): url is string {
  if (!url || url.trim().length === 0) return false;
  // Filter out local renderer URLs that won't load for external users
  if (isLocalRendererUrl(url)) return false;
  return true;
}

export function selectGalleryFeature(items: FeedItem[]): FeedItem | null {
  // Prefer visualizations with a valid publicly-reachable video URL
  const withVideo = items.filter(
    (item) => item.type === "visualization" && isValidVideoUrl(item.videoUrl),
  );

  if (withVideo.length > 0) {
    // Rotate daily: hash the date to pick consistently within a day
    const pool = withVideo.slice(0, Math.min(5, withVideo.length));
    const dayIndex =
      Math.abs(
        pool.reduce((h, item) => {
          for (let i = 0; i < item.id.length; i++) h = (h * 31 + item.id.charCodeAt(i)) | 0;
          return h;
        }, new Date().toISOString().slice(0, 10).split("-").join("").charCodeAt(0)),
      ) % pool.length;
    return pool[dayIndex];
  }

  // Fallback to any visualization (even without video — GalleryHero
  // shows MathematicalFallback but at least the title/description are real)
  const anyViz = items.find((item) => item.type === "visualization");
  if (anyViz) return anyViz;

  // Last resort — any content
  return items[0] ?? null;
}

export interface EditorialSlots {
  lead: FeedItem | null;
  story: FeedItem | null;
  supporting: FeedItem[];
}

export interface MathFieldLink {
  id: "geometry" | "calculus" | "algebra" | "probability" | "analysis";
  label: string;
  labelZh: string;
  tag: string;
  href: string;
  accent: "green" | "orange" | "blue";
  count: number;
}

const FIELD_DEFINITIONS: Array<
  Omit<MathFieldLink, "href" | "count"> & { keywords: string[] }
> = [
  {
    id: "geometry",
    label: "Geometry",
    labelZh: "几何",
    tag: "几何",
    accent: "green",
    keywords: ["几何", "拓扑", "图形", "椭圆曲线"],
  },
  {
    id: "calculus",
    label: "Calculus",
    labelZh: "微积分",
    tag: "微积分",
    accent: "orange",
    keywords: ["微积分", "导数", "积分", "极限"],
  },
  {
    id: "algebra",
    label: "Algebra",
    labelZh: "代数",
    tag: "线性代数",
    accent: "blue",
    keywords: ["代数", "矩阵", "线性代数"],
  },
  {
    id: "probability",
    label: "Probability",
    labelZh: "概率",
    tag: "概率分布",
    accent: "orange",
    keywords: ["概率", "统计", "分布"],
  },
  {
    id: "analysis",
    label: "Analysis",
    labelZh: "分析",
    tag: "傅里叶变换",
    accent: "green",
    keywords: ["傅里叶", "信号", "级数"],
  },
];

function sameItem(left: FeedItem, right: FeedItem | null): boolean {
  return Boolean(
    right && left.id === right.id && left.type === right.type,
  );
}

export function buildEditorialSlots(
  items: FeedItem[],
  feature: FeedItem | null,
): EditorialSlots {
  const available = items.filter((item) => !sameItem(item, feature));
  const lead =
    available.find((item) => item.type === "visualization") ??
    available[0] ??
    null;
  const story =
    available.find(
      (item) => item.type === "article" && !sameItem(item, lead),
    ) ?? null;
  const supporting = available
    .filter((item) => !sameItem(item, lead) && !sameItem(item, story))
    .slice(0, 4);

  return { lead, story, supporting };
}

export function buildFieldLinks(items: FeedItem[]): MathFieldLink[] {
  return FIELD_DEFINITIONS.map(({ keywords, ...field }) => {
    const count = items.filter((item) =>
      item.tags.some((tag) =>
        keywords.some((keyword) => tag.includes(keyword)),
      ),
    ).length;

    return {
      ...field,
      href: `/explore?tag=${encodeURIComponent(field.tag)}`,
      count,
    };
  });
}

export function isGalleryHeaderScrolled(
  scrollY: number,
  viewportHeight: number,
): boolean {
  return scrollY >= Math.max(80, viewportHeight * 0.72);
}

export function buildSandboxHref(prompt: string): string | null {
  const normalized = prompt.trim();
  return normalized
    ? `/sandbox?prompt=${encodeURIComponent(normalized)}`
    : null;
}
