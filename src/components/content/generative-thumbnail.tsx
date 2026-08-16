/**
 * Generative math-art thumbnail — creates abstract geometric patterns
 * deterministically from tags. Each tag palette renders a unique but
 * stable cover image. Pure CSS + SVG, no external API.
 */

import { cn } from "@/lib/utils";

// Pastel tints per math domain — inspired by Notion's card-tint system
const PALETTES: Record<string, { primary: string; secondary: string; bg: string; cardBg: string }> = {
  calculus:    { primary: "#cc785c", secondary: "#e8a55a", bg: "#ffe8d4", cardBg: "rgba(255,232,212,0.6)" },
  geometry:    { primary: "#5db8a6", secondary: "#3b82b6", bg: "#d9f3e1", cardBg: "rgba(217,243,225,0.6)" },
  algebra:     { primary: "#7c5ce7", secondary: "#a78bfa", bg: "#e6e0f5", cardBg: "rgba(230,224,245,0.6)" },
  probability: { primary: "#e8a55a", secondary: "#fbbf24", bg: "#dcecfa", cardBg: "rgba(220,236,250,0.6)" },
  analysis:    { primary: "#cc785c", secondary: "#c64545", bg: "#fde0ec", cardBg: "rgba(253,224,236,0.6)" },
  crypto:      { primary: "#181715", secondary: "#3d3d3a", bg: "#f8f5e8", cardBg: "rgba(248,245,232,0.6)" },
  default:     { primary: "#cc785c", secondary: "#5db8a6", bg: "#ffe8d4", cardBg: "rgba(255,232,212,0.5)" },
};

// Simple hash for deterministic but varied shapes per tag
function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function paletteForTags(tags: string[]) {
  const mapping: Record<string, keyof typeof PALETTES> = {
    "微积分": "calculus", "导数": "calculus", "积分": "calculus", "极限": "calculus",
    "几何": "geometry", "图形": "geometry", "拓扑": "geometry",
    "代数": "algebra", "线性代数": "algebra", "矩阵": "algebra", "椭圆曲线": "algebra",
    "概率": "probability", "统计": "probability", "正态分布": "probability", "分布": "probability",
    "傅里叶": "analysis", "信号处理": "analysis", "级数": "analysis",
    "密码学": "crypto", "加密": "crypto",
  };
  for (const tag of tags) {
    for (const [keyword, palette] of Object.entries(mapping)) {
      if (tag.includes(keyword)) {
        // Defensive fallback — an unknown key must never crash the feed.
        return PALETTES[palette] ?? PALETTES.default;
      }
    }
  }
  return PALETTES.default;
}

function generateShapes(tags: string[]): { cx: number; cy: number; r: number; fill: string; opacity: number }[] {
  const shapes: { cx: number; cy: number; r: number; fill: string; opacity: number }[] = [];
  const palette = paletteForTags(tags);
  const hash = hashTag(tags.join(","));

  // Circles
  const count = 3 + (hash % 5);
  for (let i = 0; i < count; i++) {
    const seed = ((hash * (i + 7)) ^ (hash >> (i + 1))) & 0xffff;
    shapes.push({
      cx: 15 + (seed % 70),
      cy: 15 + ((seed >> 4) % 70),
      r: 8 + ((seed >> 8) % 40),
      fill: i % 2 === 0 ? palette.primary : palette.secondary,
      opacity: 0.08 + ((seed >> 12) % 8) * 0.03,
    });
  }

  return shapes;
}

function generateLines(tags: string[]): { x1: number; y1: number; x2: number; y2: number; stroke: string; opacity: number; width: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number; stroke: string; opacity: number; width: number }[] = [];
  const palette = paletteForTags(tags);
  const hash = hashTag(tags.join(",") + "lines");

  const count = 2 + (hash % 4);
  for (let i = 0; i < count; i++) {
    const seed = ((hash * (i + 13)) ^ (hash >> (i + 3))) & 0xffff;
    lines.push({
      x1: 5 + (seed % 90),
      y1: 5 + ((seed >> 4) % 90),
      x2: 5 + ((seed >> 8) % 90),
      y2: 5 + ((seed >> 12) % 90),
      stroke: i % 2 === 0 ? palette.primary : palette.secondary,
      opacity: 0.15 + ((seed >> 2) % 5) * 0.03,
      width: 1 + ((seed >> 6) % 40) * 0.03,
    });
  }

  return lines;
}

function generateGrid(tags: string[]): { cols: number; rows: number; stroke: string; opacity: number } | null {
  const hash = hashTag(tags.join(","));
  if (hash % 3 === 0) return null; // not every thumbnail has a grid
  return {
    cols: 4 + (hash % 5),
    rows: 4 + ((hash >> 2) % 5),
    stroke: paletteForTags(tags).primary,
    opacity: 0.06 + (hash % 4) * 0.02,
  };
}

function generateFormula(tags: string[]): { text: string; x: number; y: number; color: string } | null {
  const hash = hashTag(tags.join(",") + "formula");
  if (hash % 4 !== 0) return null;

  const formulas = ["f(x)", "∑", "∫", "π", "e^{iθ}", "∇", "dx", "∞", "∂f/∂x", "lim", "det(A)", "ℝⁿ"];
  const f = formulas[hash % formulas.length];

  return {
    text: f,
    x: 10 + (hash % 75),
    y: 15 + ((hash >> 4) % 65),
    color: hash % 2 === 0 ? paletteForTags(tags).primary : paletteForTags(tags).secondary,
  };
}

interface GenerativeThumbnailProps {
  tags: string[];
  className?: string;
}

export function GenerativeThumbnail({ tags, className }: GenerativeThumbnailProps) {
  const palette = paletteForTags(tags);
  const shapes = generateShapes(tags);
  const lines = generateLines(tags);
  const grid = generateGrid(tags);
  const formula = generateFormula(tags);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundColor: palette.bg }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 70% 30%, ${palette.primary}15 0%, transparent 60%),
                       radial-gradient(ellipse at 30% 70%, ${palette.secondary}10 0%, transparent 50%)`,
        }}
      />

      {/* Grid lines (coordinate system vibe) */}
      {grid && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {Array.from({ length: grid.cols - 1 }).map((_, i) => (
            <line
              key={`vg${i}`}
              x1={((i + 1) / grid.cols) * 100}
              y1={0}
              x2={((i + 1) / grid.cols) * 100}
              y2={100}
              stroke={grid.stroke}
              strokeWidth={0.3}
              opacity={grid.opacity * 1.5}
            />
          ))}
          {Array.from({ length: grid.rows - 1 }).map((_, i) => (
            <line
              key={`hg${i}`}
              x1={0}
              y1={((i + 1) / grid.rows) * 100}
              x2={100}
              y2={((i + 1) / grid.rows) * 100}
              stroke={grid.stroke}
              strokeWidth={0.3}
              opacity={grid.opacity}
            />
          ))}
        </svg>
      )}

      {/* Background geometric shapes */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        {shapes.map((s, i) => (
          <circle key={`c${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.opacity} />
        ))}
        {lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.stroke}
            strokeWidth={l.width}
            opacity={l.opacity}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Formula decoration */}
      {formula && (
        <div
          className="absolute text-4xl font-serif italic select-none"
          style={{
            left: `${formula.x}%`,
            top: `${formula.y}%`,
            color: formula.color,
            opacity: 0.2,
            fontFamily: "var(--font-cormorant), Georgia, serif",
          }}
        >
          {formula.text}
        </div>
      )}
    </div>
  );
}
