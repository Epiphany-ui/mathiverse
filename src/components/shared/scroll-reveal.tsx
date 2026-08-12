"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
  delay?: number; // 0-9 stagger index
  threshold?: number; // 0-1 viewport threshold
  once?: boolean;
}

/**
 * Scroll-triggered reveal animation using IntersectionObserver.
 * Wraps children and adds CSS reveal classes when they enter the viewport.
 *
 * Visibility is React STATE, not an imperative classList mutation: a list
 * re-render can change the delay class (e.g. a card's index changes after
 * filtering) and React would rewrite className, wiping an imperative
 * is-visible and leaving the card stuck at opacity 0.
 */
export function ScrollReveal({
  children,
  className,
  direction = "up",
  delay,
  threshold = 0.15,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reveal immediately when the element is already inside the viewport.
    // Waiting for the IntersectionObserver races with rapid remounts
    // (e.g. filtering a list) and can leave cards stuck at opacity 0.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.unobserve(el);
  }, [threshold, once]);

  const dirClass =
    direction === "left"
      ? "reveal-left"
      : direction === "right"
        ? "reveal-right"
        : "reveal";

  const delayClass = delay !== undefined ? `reveal-d${Math.min(delay, 9) + 1}` : "";

  return (
    <div
      ref={ref}
      className={cn(dirClass, delayClass, visible && "is-visible", className)}
    >
      {children}
    </div>
  );
}
