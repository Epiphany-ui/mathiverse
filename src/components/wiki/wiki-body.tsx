"use client";

import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { TextSelectionTooltip } from "./text-selection-tooltip";
import { AnimationCard } from "./animation-card";

interface WikiBodyProps {
  slug: string;
  title: string;
  bodyMd: string;
}

interface CardInstance {
  id: string;
  prompt: string;
  /** DOM node right after the selection — card portals here */
  anchor: Node | null;
}

export function WikiBody({ slug, title, bodyMd }: WikiBodyProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);

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

      {/* Inline animation cards — portaled to their anchor positions */}
      {cards.map((card) => {
        if (!card.anchor || !card.anchor.parentNode) {
          // Fallback: render at bottom
          return (
            <div key={card.id} className="my-4">
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
          );
        }

        // Portal card right after the selection anchor
        const container = document.createElement("div");
        container.className = "my-6";
        card.anchor.parentNode.insertBefore(container, card.anchor.nextSibling);

        return createPortal(
          <div>
            <p className="text-xs text-[#6c6a64] mb-2 italic">
              为 "{card.prompt.slice(0, 60)}{card.prompt.length > 60 ? "..." : ""}" 生成动画
            </p>
            <AnimationCard
              prompt={card.prompt}
              wikiTitle={title}
              wikiSlug={slug}
              onRemove={() => {
                container.remove();
                removeCard(card.id);
              }}
            />
          </div>,
          container,
        );
      })}

      <TextSelectionTooltip
        containerRef={bodyRef}
        onAnimate={({ text, anchor }) => {
          const prompt = `为"${title}"中的概念生成 Manim 动画：\n"${text}"`;
          addCard({
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            prompt,
            anchor,
          });
        }}
      />
    </>
  );
}
