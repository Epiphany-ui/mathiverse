"use client";

import { useEffect, useState, useCallback, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

interface SelectionEvent {
  text: string;
}

interface TextSelectionTooltipProps {
  containerRef: RefObject<HTMLElement | null>;
  onAnimate: (selection: SelectionEvent) => void;
}

export function TextSelectionTooltip({
  containerRef,
  onAnimate,
}: TextSelectionTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [text, setText] = useState("");

  const handleSelection = useCallback(() => {
    // Throttle with rAF
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setVisible(false);
        return;
      }

      const selectedText = sel.toString().trim();
      if (selectedText.length < 3) {
        setVisible(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;
      const container = ancestor instanceof Element ? ancestor : ancestor.parentElement;

      // Only show inside the article body container
      if (!container || !containerRef.current?.contains(container)) {
        setVisible(false);
        return;
      }

      if (container.closest("pre, code")) {
        setVisible(false);
        return;
      }

      if (container.closest("[data-mini-sandbox]")) {
        setVisible(false);
        return;
      }

      const rect = range.getBoundingClientRect();
      const x = Math.max(12, Math.min(rect.left + rect.width / 2, window.innerWidth - 200));

      // Estimated tooltip height (~44px) + 8px margin
      const tooltipHeight = 52;

      // Default: below selection. Flip above if too close to bottom.
      let y = rect.bottom + 8;
      if (y + tooltipHeight > window.innerHeight - 8) {
        y = rect.top - tooltipHeight - 8;
      }
      // Clamp top — never go above viewport
      if (y < 8) y = 8;

      setText(selectedText.slice(0, 40));
      setPos({ x, y });
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handleSelection);
    container.addEventListener("keyup", handleSelection);
    document.addEventListener("selectionchange", handleSelection);
    window.addEventListener("scroll", () => setVisible(false), { passive: true });

    return () => {
      container.removeEventListener("mouseup", handleSelection);
      container.removeEventListener("keyup", handleSelection);
      document.removeEventListener("selectionchange", handleSelection);
      window.removeEventListener("scroll", () => setVisible(false));
    };
  }, [containerRef, handleSelection]);

  const handleClick = () => {
    setVisible(false);
    onAnimate({ text });
    window.getSelection()?.removeAllRanges();
  };

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed z-[60] pointer-events-auto animate-in fade-in slide-in-from-bottom-1 duration-150"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translateX(-50%)",
      }}
    >
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg
          bg-white/95 backdrop-blur-sm border border-[#e6dfd8]
          text-sm text-[#141413] hover:bg-[#faf9f5] transition-colors
          whitespace-nowrap cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#cc785c]" />
        <span className="max-w-[180px] truncate text-[#6c6a64]">
          "{text}"
        </span>
        <span className="text-[#cc785c] font-medium">生成动画</span>
      </button>
    </div>,
    document.body,
  );
}
