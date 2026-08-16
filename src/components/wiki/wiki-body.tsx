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
  // Every card runs a full AI + render pipeline (real money) — never create
  // a second card for text that is already generating/animated.
  const activePromptsRef = useRef(new Set<string>());

  const addCard = useCallback((card: CardRequest) => {
    if (activePromptsRef.current.has(card.prompt)) return;
    activePromptsRef.current.add(card.prompt);
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
    setCards((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) activePromptsRef.current.delete(target.prompt);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  // Resume a selection made before logging in: the tooltip redirects to
  // /auth/login and the selection itself is lost, so stash the prompt and
  // auto-create the card on return.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("wiki_pending_animation");
      if (!raw) return;
      sessionStorage.removeItem("wiki_pending_animation");
      const pending = JSON.parse(raw) as { prompt?: unknown; slug?: unknown };
      if (typeof pending.prompt === "string" && pending.slug === slug) {
        addCard({
          id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          prompt: pending.prompt,
          anchor: null,
        });
      }
    } catch { /* malformed stash — ignore */ }
  }, [slug, addCard]);

  // Cleanup on unmount
  useEffect(() => {
    const containers = containersRef.current;
    return () => {
      containers.forEach((container) => container.remove());
      containers.clear();
      activePromptsRef.current.clear();
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
          const prompt = `为"${title}"中的概念生成 Manim 动画：\n"${text}"`;
          // Generating an animation consumes AI + renderer quota — prompt
          // unauthenticated users to log in first, then resume the request.
          if (!isAuthenticated) {
            try {
              sessionStorage.setItem(
                "wiki_pending_animation",
                JSON.stringify({ prompt, slug }),
              );
            } catch {}
            router.push(
              `/auth/login?redirect=${encodeURIComponent(`/wiki/${slug}`)}`,
            );
            return;
          }
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
