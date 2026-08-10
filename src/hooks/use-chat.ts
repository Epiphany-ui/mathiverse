"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types";

import type { CodeChange } from "@/lib/ai/prompts";

interface UseChatOptions {
  onCodeExtracted?: (code: string) => void;
  onChangesApplied?: (changes: CodeChange[]) => void;
}

export function useChat({ onCodeExtracted, onChangesApplied }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是你的 Manim 动画助手。用自然语言描述你想看的数学可视化，我会帮你生成代码。\n\n💡 提示：你也可以粘贴现有的 Manim 代码，然后让我帮你修改、优化或修复。",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Send a message to the AI assistant.
   * @param content The user's message text
   * @param currentCode Optional current code from the editor for context-aware responses
   * @param isFixMode If true, sends the error as a special fix-it request
   */
  const sendMessage = useCallback(
    async (content: string, currentCode?: string, isFixMode?: boolean) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: isFixMode ? `渲染时出现以下错误，请修复代码：\n\n${content}` : content,
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

      // Fix mode: use dedicated non-streaming endpoint
      if (isFixMode) {
        try {
          const res = await fetch("/api/chat/fix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: currentCode,
              error: content,
            }),
          });

          const data = await res.json();

          if (!res.ok) throw new Error(data.error ?? "修复失败");

          if (data.mode === "diff" && data.changes?.length) {
            // V2: incremental diff — apply changes directly to editor
            const changeDescriptions = data.changes
              .map((c: CodeChange) => c.reason)
              .join("; ");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `已修复: ${changeDescriptions}` }
                  : m,
              ),
            );

            if (onChangesApplied) {
              onChangesApplied(data.changes);
            }
          } else {
            // V1 fallback: full code replacement
            const fixedCode = data.code;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: "已根据错误信息修复代码。", code: fixedCode }
                  : m,
              ),
            );

            if (fixedCode && onCodeExtracted) {
              onCodeExtracted(fixedCode);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "修复失败";
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `❌ 修复失败: ${msg}` }
                : m,
            ),
          );
        } finally {
          setIsLoading(false);
        }
        return;
      }

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
          body: JSON.stringify({
            messages: allMessages,
            currentCode: currentCode ?? "",
          }),
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
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const { content: delta } = JSON.parse(line.slice(6));
                if (delta) {
                  fullContent += delta;
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
          "你好！我是你的 Manim 动画助手。用自然语言描述你想看的数学可视化，我会帮你生成代码。\n\n💡 提示：你也可以粘贴现有的 Manim 代码，然后让我帮你修改、优化或修复。",
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
