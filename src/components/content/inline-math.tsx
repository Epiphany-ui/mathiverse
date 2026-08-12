import katex from "katex";
import { Fragment } from "react";

/**
 * Renders text with inline math: segments wrapped in $...$ are rendered
 * with KaTeX, the rest as plain text.  Server- and client-safe
 * (renderToString, no DOM access).
 */
export function InlineMath({ text }: { text: string }) {
  const parts = text.split(/\$([^$]+)\$/g);

  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          // Math segment
          return (
            <span
              key={index}
              className="inline-math"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(part, {
                  throwOnError: false,
                  displayMode: false,
                }),
              }}
            />
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
