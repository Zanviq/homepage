"use client";

import { useEffect } from "react";
import { applyPaperVars } from "@/lib/card/paper";

/**
 * Generates the paper tiles once after first paint and exposes them as CSS
 * variables: page background, sheets, the card box board, dark panels.
 */
export function PaperVars() {
  useEffect(() => {
    const run = () =>
      void applyPaperVars({
        "--tex-bg": ["paper", 0.14],
        "--tex-card": ["cotton", 0.2],
        "--tex-board": ["cotton", 0.28],
        "--tex-dark": ["cotton", 0.22],
      });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback?.(run, { timeout: 900 });
    const timer = idle === undefined ? window.setTimeout(run, 120) : undefined;
    return () => {
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  return null;
}
