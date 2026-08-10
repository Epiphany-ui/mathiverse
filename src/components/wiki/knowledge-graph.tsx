"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";

interface GraphNode {
  id: string;
  slug: string;
  title: string;
  category: string;
  color: string;
  viewsCount: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
}

interface KnowledgeGraphProps {
  centerSlug: string;
  centerTitle: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  className?: string;
}

/** Simple radial layout for the knowledge graph. */
function radialLayout(
  centerId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const center = nodes.find((n) => n.id === centerId);
  if (!center) return { positions: new Map<string, { x: number; y: number }>(), edgeList: [] as { from: { x: number; y: number }; to: { x: number; y: number }; label: string }[] };

  const positions = new Map<string, { x: number; y: number }>();
  const cx = width / 2;
  const cy = height / 2;
  positions.set(centerId, { x: cx, y: cy });

  // Find direct connections to center
  const directEdges = edges.filter((e) => e.source === centerId || e.target === centerId);
  const directIds = new Set(directEdges.map((e) => (e.source === centerId ? e.target : e.source)));

  // Find second-layer connections
  const secondEdges = edges.filter((e) => {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    return (directIds.has(e.source) && !directIds.has(e.target) && e.target !== centerId) ||
           (directIds.has(e.target) && !directIds.has(e.source) && e.source !== centerId);
  });
  const secondIds = new Set(
    secondEdges.map((e) => (directIds.has(e.source) ? e.target : e.source)),
  );

  // Layout: center → inner ring → outer ring
  const innerRing = [...directIds].filter((id) => nodeMap.has(id));
  const outerRing = [...secondIds].filter((id) => nodeMap.has(id) && !directIds.has(id));

  const innerR = Math.min(width, height) * 0.28;
  const outerR = Math.min(width, height) * 0.42;

  innerRing.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / innerRing.length - Math.PI / 2;
    positions.set(id, {
      x: cx + innerR * Math.cos(angle),
      y: cy + innerR * Math.sin(angle),
    });
  });

  outerRing.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(outerRing.length, 1) - Math.PI / 2;
    positions.set(id, {
      x: cx + outerR * Math.cos(angle + 0.3),
      y: cy + outerR * Math.sin(angle + 0.3),
    });
  });

  // Build edge visual list
  const edgeList = edges
    .filter((e) => positions.has(e.source) && positions.has(e.target))
    .map((e) => ({
      from: positions.get(e.source)!,
      to: positions.get(e.target)!,
      label: e.label,
    }));

  return { positions, edgeList };
}

export function KnowledgeGraph({
  centerSlug,
  centerTitle,
  nodes,
  edges,
  className = "",
}: KnowledgeGraphProps) {
  const [expanded, setExpanded] = useState(false);
  const svgW = expanded ? 800 : 600;
  const svgH = expanded ? 600 : 380;
  const centerNode = nodes.find((n) => n.isCenter);

  const { positions, edgeList } = useMemo(
    () => radialLayout(centerNode?.id ?? "", nodes, edges, svgW, svgH),
    [nodes, edges, centerNode, svgW, svgH],
  );

  if (nodes.length <= 1) {
    return (
      <div className={`rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 p-6 text-center ${className}`}>
        <span className="text-2xl">(・・？)</span>
        <p className="text-sm text-[#6c6a64] mt-2">这个词条还没有建立关联</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/40 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-[#6c6a64]">知识关联</span>
        <div className="flex-1" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-[#6c6a64] hover:text-[#141413] transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" />
          {expanded ? "收起" : "展开全屏"}
        </button>
      </div>

      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="overflow-visible"
      >
        {/* Edges */}
        {edgeList.map((e, i) => {
          const midX = (e.from.x + e.to.x) / 2;
          const midY = (e.from.y + e.to.y) / 2;
          return (
            <g key={`edge-${i}`}>
              <line
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke="#e6dfd8"
                strokeWidth={1.2}
              />
              <foreignObject
                x={midX - 40}
                y={midY - 14}
                width={80}
                height={16}
                className="overflow-visible"
              >
                <div className="text-[10px] text-[#6c6a64] text-center bg-[#fdf8f5]/90 px-1 rounded whitespace-nowrap leading-[16px]">
                  {e.label}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const radius = node.isCenter ? 22 : 8 + node.viewsCount * 0.02;
          const clampedR = Math.min(Math.max(radius, 8), 18);

          return (
            <g key={node.id}>
              {node.isCenter && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={clampedR + 6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  opacity={0.5}
                />
              )}
              <Link href={`/wiki/${node.slug}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={clampedR}
                  fill={node.isCenter ? node.color : `${node.color}40`}
                  stroke={node.isCenter ? node.color : `${node.color}60`}
                  strokeWidth={node.isCenter ? 2.5 : 1}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
              <Link href={`/wiki/${node.slug}`}>
                <text
                  x={pos.x}
                  y={pos.y + clampedR + 14}
                  textAnchor="middle"
                  className="cursor-pointer hover:text-[#cc785c] transition-colors"
                  style={{
                    fontSize: node.isCenter ? "13px" : "11px",
                    fontWeight: node.isCenter ? 600 : 400,
                    fill: node.isCenter ? "#141413" : "#3d3d3a",
                  }}
                >
                  {node.title.length > 8 ? node.title.slice(0, 7) + "…" : node.title}
                </text>
              </Link>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
