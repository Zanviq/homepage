"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown with the editorial `.prose-zanviq` styling.
 * Relative image URLs (e.g. /api/media/...) resolve against the same origin.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-zanviq">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
