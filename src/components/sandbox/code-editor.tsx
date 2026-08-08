"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";

// Custom dark theme matching Mathiverse design system
const mathiverseTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "oklch(0.13 0.02 265 / 0.6)",
      color: "#e2e8f0",
      height: "100%",
      fontSize: "14px",
    },
    ".cm-content": {
      caretColor: "#7c3aed",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      lineHeight: "1.7",
      padding: "16px 0",
    },
    ".cm-gutters": {
      backgroundColor: "oklch(0.13 0.02 265 / 0.3)",
      color: "#64748b",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      fontSize: "12px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(124, 58, 237, 0.15)",
      color: "#a78bfa",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(124, 58, 237, 0.08)",
    },
    ".cm-cursor": {
      borderLeftColor: "#7c3aed",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(124, 58, 237, 0.25) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(124, 58, 237, 0.2)",
      outline: "1px solid #7c3aed",
    },
    ".cm-tooltip": {
      backgroundColor: "oklch(0.18 0.02 265)",
      border: "1px solid rgba(124, 58, 237, 0.3)",
      color: "#e2e8f0",
    },
    ".cm-search": {
      backgroundColor: "oklch(0.18 0.02 265)",
      "& input": {
        backgroundColor: "oklch(0.15 0.02 265)",
        color: "#e2e8f0",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "4px 8px",
        borderRadius: "4px",
      },
      "& button": {
        color: "#a78bfa",
      },
    },
  },
  { dark: true },
);

// Python syntax highlighting colors
const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c084fc" },
  { tag: tags.string, color: "#34d399" },
  { tag: tags.number, color: "#fbbf24" },
  { tag: tags.comment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#60a5fa" },
  { tag: tags.definition(tags.variableName), color: "#60a5fa" },
  { tag: tags.typeName, color: "#38bdf8" },
  { tag: tags.operator, color: "#e879f9" },
  { tag: tags.className, color: "#38bdf8" },
  { tag: tags.propertyName, color: "#a78bfa" },
  { tag: tags.macroName, color: "#06b6d4" },
  { tag: tags.standard(tags.function(tags.variableName)), color: "#60a5fa" },
  { tag: tags.standard(tags.typeName), color: "#38bdf8" },
]);

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  autoFocus = true,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Keep track of the latest value for external updates
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleChange = useCallback(
    (val: string) => {
      valueRef.current = val;
      onChange?.(val);
    },
    [onChange],
  );

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        handleChange(update.state.doc.toString());
      }
    });

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      python(),
      syntaxHighlighting(pythonHighlightStyle),
      mathiverseTheme,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...completionKeymap,
      ]),
      autocompletion(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          handleChange(update.state.doc.toString());
        }
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    if (autoFocus && !readOnly) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only create once

  // Handle external value changes (e.g. AI generated code)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc && value !== valueRef.current) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="h-full overflow-auto"
      style={{ minHeight: 0 }}
    />
  );
}
