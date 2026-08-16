"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
} from "@codemirror/view";
import type { CodeChange } from "@/lib/ai/prompts";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";

// Custom dark theme matching Mathiverse warm design system
const mathiverseTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#181715",
      color: "#faf9f5",
      height: "100%",
      fontSize: "14px",
    },
    ".cm-content": {
      caretColor: "#cc785c",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      lineHeight: "1.7",
      padding: "16px 0",
    },
    ".cm-gutters": {
      backgroundColor: "#1f1e1b",
      color: "#8e8b82",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      fontSize: "12px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(204, 120, 92, 0.12)",
      color: "#cc785c",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(204, 120, 92, 0.06)",
    },
    ".cm-cursor": {
      borderLeftColor: "#cc785c",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(204, 120, 92, 0.2) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(204, 120, 92, 0.15)",
      outline: "1px solid #cc785c",
    },
    ".cm-error-line": {
      backgroundColor: "rgba(204, 120, 92, 0.16)",
      borderLeft: "2px solid #cc785c",
    },
    ".cm-diff-lines": {
      backgroundColor: "rgba(121, 216, 199, 0.14)",
    },
    ".cm-tooltip": {
      backgroundColor: "#252320",
      border: "1px solid rgba(204, 120, 92, 0.25)",
      color: "#faf9f5",
    },
    ".cm-search": {
      backgroundColor: "#252320",
      "& input": {
        backgroundColor: "#1f1e1b",
        color: "#faf9f5",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "4px 8px",
        borderRadius: "4px",
      },
      "& button": {
        color: "#cc785c",
      },
    },
  },
  { dark: true },
);

// Python syntax highlighting with warm Anthropic tones
const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#cc785c" },
  { tag: tags.string, color: "#5db8a6" },
  { tag: tags.number, color: "#e8a55a" },
  { tag: tags.comment, color: "#8e8b82", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#5db8a6" },
  { tag: tags.definition(tags.variableName), color: "#5db8a6" },
  { tag: tags.typeName, color: "#e8a55a" },
  { tag: tags.operator, color: "#cc785c" },
  { tag: tags.className, color: "#e8a55a" },
  { tag: tags.propertyName, color: "#e8a55a" },
  { tag: tags.macroName, color: "#5db8a6" },
  { tag: tags.standard(tags.function(tags.variableName)), color: "#5db8a6" },
  { tag: tags.standard(tags.typeName), color: "#e8a55a" },
]);

/** Mark the error line from render/validation diagnostics. */
const setErrorLineEffect = StateEffect.define<{ from: number; to: number } | null>();
const errorLineField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update: (value, tr) => {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setErrorLineEffect)) next = effect.value;
    }
    // Any edit invalidates the mark — the error refers to the old code.
    if (tr.docChanged && next) next = null;
    return next;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) =>
      value
        ? Decoration.set([Decoration.line({ class: "cm-error-line" }).range(value.from)])
        : Decoration.none,
    ),
});

/** Highlight the block that changed when comparing against a version. */
const setDiffEffect = StateEffect.define<{ from: number; to: number } | null>();
const diffField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update: (value, tr) => {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setDiffEffect)) next = effect.value;
    }
    if (tr.docChanged && next) next = null;
    return next;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) =>
      value
        ? Decoration.set([Decoration.mark({ class: "cm-diff-lines" }).range(value.from, value.to)])
        : Decoration.none,
    ),
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  /** Incremental changes to apply with canvas erase animation. */
  applyChanges?: CodeChange[] | null;
  /** Called after all changes have been applied. */
  onChangesDone?: () => void;
  externalUpdateMode?: "immediate" | "paint";
  /**
   * Stable trigger for the typewriter animation.  When versionId changes
   * (a new AI version was created or the user rolled back), the editor
   * animates the incoming code.  Using a stable id instead of the value
   * string avoids the re-render / racing-dispatch restart problem.
   */
  versionId?: string | null;
  /** 1-based line to highlight as the source of the current error. */
  errorLine?: number | null;
  /** Bump to re-apply the highlight for the same line twice. */
  errorLineNonce?: number;
  /** 1-based inclusive line range to tint as "changed since last version". */
  diffRange?: { start: number; end: number; nonce: number } | null;
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  autoFocus = true,
  applyChanges,
  onChangesDone,
  externalUpdateMode = "paint",
  versionId,
  errorLine,
  errorLineNonce,
  diffRange,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Tracks whether the EditorView is still alive (view.destroyed is private).
  const viewDestroyedRef = useRef(false);
  const typewriterRef = useRef<AbortController | null>(null);
  const typewritingRef = useRef(false);
  const canvasOverlayRef = useRef<HTMLDivElement>(null);
  // The code the active typewriter is targeting.  When the same value
  // arrives from a second dispatch (snapshot.received after refreshSnapshot
  // races with version.created), we skip the restart so the animation isn't
  // aborted and the user doesn't see a blank-then-instant-pop.
  const typewriterTargetRef = useRef<string | null>(null);

  // Track value ONLY from editor changes — never sync from props
  const editorValueRef = useRef(value);
  // Stable ref for callbacks so typewriteCode identity doesn't change on every
  // render (which would re-trigger the useEffect and abort the animation).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleChange = useCallback((val: string) => {
    editorValueRef.current = val;
    // Suppress onChange during typewriter animation to prevent the doc-clear
    // step from triggering a setCode("") that re-enters useEffect.
    if (!typewritingRef.current) {
      onChangeRef.current?.(val);
    }
  }, []);

  // Typewriter: erase canvas → paint new code character by character
  const typewriteCode = useCallback(
    async (view: EditorView, targetCode: string) => {
      // Cancel any ongoing typewriter
      typewriterRef.current?.abort();
      typewriterTargetRef.current = targetCode;
      const controller = new AbortController();
      typewriterRef.current = controller;
      typewritingRef.current = true;

      const currentDoc = view.state.doc.toString();

      // Always start fresh: clear the entire canvas
      if (currentDoc.length > 0) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: "" },
        });
      }

      const CHUNK_SIZE = 4; // chars per frame
      const INTERVAL = 18; // ~55fps

      let pos = 0;

      for (let i = 0; i < targetCode.length; i += CHUNK_SIZE) {
        if (controller.signal.aborted) {
          // Aborted mid-paint: sync the current document (including any
          // keystrokes typed during the animation) to the parent so nothing
          // is lost, and re-enable change propagation.
          typewritingRef.current = false;
          typewriterTargetRef.current = null;
          const abortedDoc = view.state.doc.toString();
          editorValueRef.current = abortedDoc;
          onChangeRef.current?.(abortedDoc);
          return;
        }

        // Guard against the doc being replaced externally (defense-in-depth)
        if (pos > view.state.doc.length) return;

        const chunk = targetCode.slice(i, i + CHUNK_SIZE);
        view.dispatch({
          changes: { from: pos, to: pos, insert: chunk },
        });
        pos += chunk.length;

        // Glow pulses while painting
        const overlay = canvasOverlayRef.current;
        if (overlay) {
          overlay.style.transition = "none";
          overlay.style.opacity = String(0.06 + Math.random() * 0.08);
        }

        // Slow down at newlines for dramatic effect
        const isNewline = chunk.includes("\n");
        const delay = INTERVAL + Math.random() * 10 + (isNewline ? 25 : 0);

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }

      // Glow fades out when done
      const overlay = canvasOverlayRef.current;
      if (overlay) {
        overlay.style.transition = "opacity 0.8s ease-out";
        overlay.style.opacity = "0";
      }

      // Sync final value to parent now that animation is complete
      typewritingRef.current = false;
      typewriterTargetRef.current = null;
      const finalDoc = view.state.doc.toString();
      editorValueRef.current = finalDoc;
      onChangeRef.current?.(finalDoc);
    },
    [],
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
      errorLineField,
      diffField,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...completionKeymap,
      ]),
      autocompletion(),
      updateListener,
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
    viewDestroyedRef.current = false;

    if (autoFocus && !readOnly) {
      view.focus();
    }

    return () => {
      viewDestroyedRef.current = true;
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only create once

  // Trigger typewriter when a new version arrives (AI generation, rollback).
  // Using versionId as the trigger instead of value avoids restarts caused by
  // re-renders from unrelated state changes (SSE phase events, refreshSnapshot).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !versionId) return;

    const currentDoc = view.state.doc.toString();
    if (value === currentDoc) return; // already showing this code

    // If a typewriter is already animating to this exact code, skip
    if (typewriterTargetRef.current === value) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Large documents (e.g. rolling back to a long version) paint instantly —
    // the typewriter would take minutes and feel like a hang.
    const largeSync = value.length > 4_000 || currentDoc.length > 4_000;
    if (externalUpdateMode === "immediate" || reduceMotion || largeSync) {
      typewriterRef.current?.abort();
      typewriterTargetRef.current = null;
      typewritingRef.current = true;
      view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: value } });
      typewritingRef.current = false;
      editorValueRef.current = value;
    } else {
      void typewriteCode(view, value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  // External code injected WITHOUT a versionId (fork prefill, localStorage
  // restore, wiki mini-sandbox AI output) — replace the document directly.
  // Editor-initiated changes are skipped because they already match.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || versionId || typewritingRef.current) return;
    const currentDoc = view.state.doc.toString();
    if (value === currentDoc) return;
    typewriterRef.current?.abort();
    view.dispatch({ changes: { from: 0, to: currentDoc.length, insert: value } });
    editorValueRef.current = value;
  }, [value, versionId]);

  // Highlight the line that caused the latest render/validation failure.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || errorLineNonce === undefined) return;
    if (!errorLine) {
      view.dispatch({ effects: setErrorLineEffect.of(null) });
      return;
    }
    const doc = view.state.doc;
    const lineNo = Math.min(Math.max(1, errorLine), doc.lines);
    const line = doc.line(lineNo);
    view.dispatch({
      effects: [
        setErrorLineEffect.of({ from: line.from, to: line.to }),
        EditorView.scrollIntoView(line.from, { y: "center" }),
      ],
      selection: { anchor: line.from },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorLineNonce]);

  // Tint the block that changed relative to the version just rolled back to.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !diffRange) return;
    const doc = view.state.doc;
    const startLine = Math.min(Math.max(1, diffRange.start), doc.lines);
    const endLine = Math.min(Math.max(1, diffRange.end), doc.lines);
    const from = doc.line(startLine).from;
    const to = doc.line(endLine).to;
    view.dispatch({
      effects: [
        setDiffEffect.of({ from, to }),
        EditorView.scrollIntoView(from, { y: "center" }),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffRange?.nonce]);

  // Incremental change application with canvas erase/write animation.
  // Abortable: a newer batch, unmount, or prop reset cancels the animation
  // mid-flight so stale dispatches never hit a destroyed editor view.
  const incrementalAbortRef = useRef<AbortController | null>(null);
  const appliedChangesRef = useRef<CodeChange[] | null>(null);

  const applyIncrementalChanges = useCallback(
    async (view: EditorView, changes: CodeChange[]) => {
      incrementalAbortRef.current?.abort();
      const controller = new AbortController();
      incrementalAbortRef.current = controller;
      const signal = controller.signal;

      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, ms);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });

      const overlay = canvasOverlayRef.current;

      // Process changes in order
      for (let i = 0; i < changes.length; i++) {
        if (signal.aborted || viewDestroyedRef.current) return;
        const ch = changes[i];
        // Read doc fresh each iteration — it changes after each dispatch
        const doc = view.state.doc;
        const line = doc.line(Math.min(ch.startLine, doc.lines));
        const endLine = doc.line(Math.min(ch.endLine, doc.lines));

        const from = line.from;
        const to = endLine.to;

        // Phase 1: Erase glow (red flash)
        if (overlay) {
          overlay.style.transition = "none";
          overlay.style.opacity = "0.5";
          overlay.style.boxShadow =
            "inset 0 0 120px rgba(220, 80, 60, 0.4), inset 0 0 40px rgba(220, 80, 60, 0.2)";
        }
        await sleep(200);
        if (signal.aborted || viewDestroyedRef.current) return;

        // Phase 2: Replace text
        view.dispatch({
          changes: { from, to, insert: ch.newCode },
          // Scroll changed area into view
          effects: EditorView.scrollIntoView(from, { y: "center" }),
        });

        // Phase 3: Write glow (green flash)
        if (overlay) {
          overlay.style.transition = "none";
          overlay.style.opacity = "0.4";
          overlay.style.boxShadow =
            "inset 0 0 120px rgba(93, 184, 166, 0.3), inset 0 0 40px rgba(93, 184, 166, 0.15)";
        }
        await sleep(150);
        if (signal.aborted || viewDestroyedRef.current) return;

        // Fade out
        if (overlay) {
          overlay.style.transition = "opacity 1.5s ease-out";
          overlay.style.opacity = "0";
          overlay.style.boxShadow =
            "inset 0 0 120px rgba(204, 120, 92, 0.2), inset 0 0 40px rgba(232, 165, 90, 0.1)";
        }

        // Stagger between multiple changes
        if (i < changes.length - 1) {
          await sleep(100);
        }
      }

      if (signal.aborted || viewDestroyedRef.current) return;

      // Scroll to first changed line
      const finalDoc = view.state.doc;
      const firstLine = finalDoc.line(
        Math.min(changes[0].startLine, finalDoc.lines),
      );
      view.dispatch({
        selection: { anchor: firstLine.from },
        effects: EditorView.scrollIntoView(firstLine.from, { y: "center" }),
      });

      onChangesDone?.();
    },
    [onChangesDone],
  );

  // Watch for incremental changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !applyChanges?.length) return;

    // Skip a batch we already processed (StrictMode double-run or an
    // identical array re-created by the parent).
    if (appliedChangesRef.current === applyChanges) return;
    appliedChangesRef.current = applyChanges;
    void applyIncrementalChanges(view, applyChanges);

    return () => {
      incrementalAbortRef.current?.abort();
    };
  }, [applyChanges, applyIncrementalChanges]);

  return (
    <div className="relative h-full" style={{ minHeight: 0 }}>
      {/* Canvas overlay — subtle glow while AI is "painting" code */}
      <div
        ref={canvasOverlayRef}
        className="absolute inset-0 pointer-events-none z-10 opacity-0"
        style={{
          boxShadow: "inset 0 0 120px rgba(204, 120, 92, 0.2), inset 0 0 40px rgba(232, 165, 90, 0.1)",
          transition: "opacity 0.6s ease-out",
        }}
      />
      <div
        ref={editorRef}
        className="h-full overflow-auto"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
