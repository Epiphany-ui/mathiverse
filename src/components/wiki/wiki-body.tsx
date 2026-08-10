"use client";

import { useRef, useState, useCallback } from "react";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { TextSelectionTooltip } from "./text-selection-tooltip";
import { AnimationCard } from "./animation-card";
import { MiniSandbox } from "./mini-sandbox";

interface WikiBodyProps {
  slug: string;
  title: string;
  bodyMd: string;
}

interface CardInstance {
  id: string;
  prompt: string;
}

export function WikiBody({ slug, title, bodyMd }: WikiBodyProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);
  const [sandbox, setSandbox] = useState<{
    open: boolean;
    prompt: string;
  } | null>(null);

  const addCard = useCallback((card: CardInstance) => {
    setCards((prev) => [...prev, card]);
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return (
    <>
      <div ref={bodyRef}>
        <MarkdownRenderer content={bodyMd} />
      </div>

      {/* Inline animation cards — stack below article body */}
      {cards.length > 0 && (
        <div className="space-y-4 mt-6">
          {cards.map((card) => (
            <div key={card.id}>
              <p className="text-xs text-[#6c6a64] mb-2 italic">
                为 "{card.prompt.slice(0, 60)}{card.prompt.length > 60 ? "..." : ""}" 生成动画
              </p>
              <AnimationCard
                prompt={card.prompt}
                wikiTitle={title}
                wikiSlug={slug}
                onRemove={() => removeCard(card.id)}
              />
            </div>
          ))}
        </div>
      )}

      <TextSelectionTooltip
        containerRef={bodyRef}
        onAnimate={({ text }) => {
          const prompt = `为"${title}"中的概念生成 Manim 动画：\n"${text}"`;
          addCard({ id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, prompt });
        }}
      />

      {/* Sandbox — only opens on explicit user action from cards */}
      <MiniSandbox
        open={sandbox?.open ?? false}
        initialPrompt={sandbox?.prompt ?? ""}
        wikiTitle={title}
        wikiSlug={slug}
        onClose={() => setSandbox(null)}
      />
    </>
  );
}
