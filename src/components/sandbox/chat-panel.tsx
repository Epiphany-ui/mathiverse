"use client";

import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, User, Trash2, Square } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (content: string) => void;
  onCancel: () => void;
  onClear: () => void;
  className?: string;
}

function ChatBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  const isWelcome = message.id === "welcome";

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-gradient-to-br from-secondary to-accent"
            : "bg-gradient-to-br from-primary to-secondary",
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <GlassCard
        className={cn(
          "p-3 max-w-[85%]",
          isUser
            ? "bg-primary/10 border-primary/20"
            : "bg-white/[0.03]",
        )}
        hover={false}
      >
        <div className="text-sm leading-relaxed break-words chat-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                ) : (
                  <code className="text-xs font-mono" {...props}>{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-background/50 rounded p-2 overflow-x-auto text-xs font-mono my-1.5">{children}</pre>
              ),
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
              h1: ({ children }) => <h1 className="font-bold text-base mb-1 mt-2">{children}</h1>,
              h2: ({ children }) => <h2 className="font-bold text-sm mb-1 mt-2">{children}</h2>,
              h3: ({ children }) => <h3 className="font-bold text-sm mb-1 mt-1.5">{children}</h3>,
              strong: ({ children }) => <strong className="font-semibold text-purple-300">{children}</strong>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/30 pl-2.5 italic text-muted-foreground my-1.5">{children}</blockquote>
              ),
            }}
          >
            {message.content || (message.id === "welcome" ? undefined : "▊")}
          </ReactMarkdown>
        </div>
        {message.code && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="text-xs text-muted-foreground mb-1">
              已提取 Python 代码
            </div>
            <pre className="text-xs font-mono bg-background/50 rounded p-2 overflow-x-auto max-h-20 overflow-y-auto">
              <code>{message.code.slice(0, 200)}...</code>
            </pre>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export function ChatPanel({
  messages,
  isLoading,
  onSend,
  onCancel,
  onClear,
  className,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const text = inputRef.current?.value.trim();
    if (!text || isLoading) return;
    onSend(text);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          AI 对话助手
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClear}
          title="清空对话"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isLoading && !messages[messages.length - 1]?.content && (
          <div className="flex items-center gap-2 pl-11">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 space-y-2">
        <div className="relative">
          <Textarea
            ref={inputRef}
            placeholder="描述你想生成的数学动画..."
            className="min-h-[60px] resize-none bg-white/5 border-white/10 pr-10 text-sm"
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Enter 发送 · Shift+Enter 换行
          </span>
          <div className="flex items-center gap-2">
            {isLoading && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                onClick={onCancel}
              >
                <Square className="w-3 h-3" />
                停止
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1 h-8 bg-gradient-to-r from-primary to-secondary"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              <Sparkles className="w-3.5 h-3.5" />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
