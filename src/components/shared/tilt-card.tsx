"use client";

import { useRef, useCallback, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number; // degrees, default 8
}

/**
 * 3D tilt card — follows mouse position for a subtle perspective effect.
 * Apply .card-tilt CSS class for the transform + shadow behavior.
 */
export function TiltCard({ children, className, maxTilt = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const card = ref.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      card.style.setProperty("--tilt-x", `${-y * maxTilt}deg`);
      card.style.setProperty("--tilt-y", `${x * maxTilt}deg`);

      // Add tilting class for faster transition during active tilt
      if (!card.classList.contains("tilting")) {
        card.classList.add("tilting");
      }
    },
    [maxTilt],
  );

  const handleMouseLeave = useCallback(() => {
    const card = ref.current;
    if (!card) return;

    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.classList.remove("tilting");
  }, []);

  return (
    <div
      ref={ref}
      className={cn("card-tilt", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
