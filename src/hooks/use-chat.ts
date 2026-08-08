"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types";

interface UseChatOptions {
  onCodeExtracted?: (code: string) => void;
}

export function useChat({ onCodeExtracted }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是你的 Manim 动画助手。用自然语言描述你想看的数学可视化，我会帮你生成代码。",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Placeholder for assistant response
      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsLoading(true);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const allMessages = [...messages, userMsg]
          .filter((m) => m.id !== "welcome")
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "请求失败");
        }

        // Read SSE stream
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const { content } = JSON.parse(line.slice(6));
                if (content) {
                  fullContent += content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: fullContent }
                        : m,
                    ),
                  );
                }
              } catch {
                // skip parse errors
              }
            }
          }
        }

        // Extract code from response
        const { extractCode } = await import("@/lib/ai/prompts");
        const code = extractCode(fullContent);
        if (code && onCodeExtracted) {
          onCodeExtracted(code);
        }
        if (code) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, code } : m,
            ),
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || "已取消" }
                : m,
            ),
          );
        } else {
          const msg =
            err instanceof Error ? err.message : "发送失败，请重试";
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `❌ 错误: ${msg}` }
                : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading, onCodeExtracted],
  );

  const cancelSend = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "你好！我是你的 Manim 动画助手。用自然语言描述你想看的数学可视化，我会帮你生成代码。",
      },
    ]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelSend,
    clearMessages,
  };
}
