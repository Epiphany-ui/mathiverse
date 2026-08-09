"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          if (once) observer.unobserve(el);
        } else if (!once) {
          el.classList.remove("is-visible");
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
    <div ref={ref} className={cn(dirClass, delayClass, className)}>
      {children}
    </div>
  );
}
