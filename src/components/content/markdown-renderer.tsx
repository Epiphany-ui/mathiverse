"use client";

import { Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// KaTeX errors from malformed AI-generated LaTeX shouldn't crash the page.
// rehype-katex v7 hardcodes throwOnError:true for display math, so we need
// an error boundary as a safety net.
class MathErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-[#e6dfd8] bg-[#fdf8f5] px-4 py-3 text-sm text-[#6c6a64]">
          <AlertTriangle className="w-4 h-4 text-[#cc785c]/60 shrink-0" />
          公式渲染出错，请刷新页面重试
        </div>
      );
    }
    return this.props.children;
  }
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose dark:prose-invert max-w-none", className)}>
      <MathErrorBoundary>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false }]]}
        components={{
          // Style code blocks
          pre: ({ children, ...props }) => (
            <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto" {...props}>
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("text-sm font-mono", className)} {...props}>
                {children}
              </code>
            );
          },
          // Style links
          a: ({ children, ...props }) => (
            <a
              className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          // Style images
          img: ({ alt, ...props }) => (
            <img
              alt={alt || ""}
              className="rounded-lg border border-border"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      </MathErrorBoundary>
    </div>
  );
}
