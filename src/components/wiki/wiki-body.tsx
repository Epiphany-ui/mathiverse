"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { TextSelectionTooltip } from "./text-selection-tooltip";
import { AnimationCard } from "./animation-card";

interface WikiBodyProps {
  slug: string;
  title: string;
  bodyMd: string;
  isAuthenticated: boolean;
}

interface CardInstance {
  id: string;
  prompt: string;
  container: HTMLDivElement | null;
}

interface CardRequest {
  id: string;
  prompt: string;
  anchor: Node | null;
}

export function WikiBody({ slug, title, bodyMd, isAuthenticated }: WikiBodyProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);
  // Track portal containers — created once, cleaned up on removal
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const addCard = useCallback((card: CardRequest) => {
    let container: HTMLDivElement | null = null;
    if (card.anchor?.parentNode) {
      container = document.createElement("div");
      container.className = "my-6";
      card.anchor.parentNode.insertBefore(container, card.anchor.nextSibling);
      containersRef.current.set(card.id, container);
    }
    setCards((prev) => [
      ...prev,
      { id: card.id, prompt: card.prompt, container },
    ]);
  }, []);

  const removeCard = useCallback((id: string) => {
    // Remove the portal container from DOM
    const container = containersRef.current.get(id);
    if (container) {
      container.remove();
      containersRef.current.delete(id);
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const containers = containersRef.current;
    return () => {
      containers.forEach((container) => container.remove());
      containers.clear();
    };
  }, []);

  return (
    <>
      <div ref={bodyRef}>
        <MarkdownRenderer content={bodyMd} />
      </div>

      {cards.map((card) => {
        if (!card.container) {
          return (
            <div key={card.id} className="my-4">
              <p className="text-xs text-[#6c6a64] mb-2 italic">
                为「{card.prompt.slice(0, 60)}{card.prompt.length > 60 ? "..." : ""}」生成动画
              </p>
              <AnimationCard
                key={card.id}
                prompt={card.prompt}
                wikiTitle={title}
                wikiSlug={slug}
                onRemove={() => removeCard(card.id)}
              />
            </div>
          );
        }

        return createPortal(
          <div>
            <p className="text-xs text-[#6c6a64] mb-2 italic">
              为「{card.prompt.slice(0, 60)}{card.prompt.length > 60 ? "..." : ""}」生成动画
            </p>
            <AnimationCard
              key={card.id}
              prompt={card.prompt}
              wikiTitle={title}
              wikiSlug={slug}
              onRemove={() => removeCard(card.id)}
            />
          </div>,
          card.container,
        );
      })}

      <TextSelectionTooltip
        containerRef={bodyRef}
        onAnimate={({ text, anchor }) => {
          // Generating an animation consumes AI + renderer quota — prompt
          // unauthenticated users to log in first.
          if (!isAuthenticated) {
            router.push(
              `/auth/login?redirect=${encodeURIComponent(`/wiki/${slug}`)}`,
            );
            return;
          }
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
