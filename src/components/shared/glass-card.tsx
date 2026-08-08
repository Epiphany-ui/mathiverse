import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  variant?: "cream" | "canvas" | "dark";
}

export function GlassCard({
  className,
  hover = true,
  variant = "cream",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variant === "dark"
          ? "card-dark"
          : variant === "canvas"
            ? "card-canvas"
            : "card-cream",
        !hover && "hover:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
