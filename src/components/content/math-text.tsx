import katex from "katex";
import { Fragment } from "react";

/**
 * Renders text with KaTeX math everywhere plain text appears: inline $...$
 * and display $$...$$ segments become real formulas, the rest stays plain
 * text (line breaks preserved).  Server- and client-safe (renderToString,
 * no DOM access).
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  // Display math first, then inline math inside the remaining segments.
  const displayParts = text.split(/\$\$([^]+?)\$\$/g);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {displayParts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <span
              key={`d${index}`}
              className="inline-math block"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(part, {
                  throwOnError: false,
                  displayMode: true,
                }),
              }}
            />
          );
        }
        const inlineParts = part.split(/\$([^]+?)\$/g);
        return (
          <Fragment key={`t${index}`}>
            {inlineParts.map((inline, inlineIndex) => {
              if (inlineIndex % 2 === 1) {
                return (
                  <span
                    key={`i${inlineIndex}`}
                    className="inline-math"
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(inline, {
                        throwOnError: false,
                        displayMode: false,
                      }),
                    }}
                  />
                );
              }
              return <Fragment key={`p${inlineIndex}`}>{inline}</Fragment>;
            })}
          </Fragment>
        );
      })}
    </span>
  );
}
