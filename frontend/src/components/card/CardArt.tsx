"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { elementStyle } from "@/lib/card/motion";
import { PAPER_TILE, paperTexture } from "@/lib/card/paper";
import type { Background, CardDesign, CardElement, FaceKey, FontKey, PaperKind, QrElement, Shadow } from "@/lib/card/types";
import type { Lang } from "@/lib/types";

export const FONT_STACK: Record<FontKey, string> = {
  display: "var(--font-display), Georgia, serif",
  body: "var(--font-body), Pretendard, system-ui, sans-serif",
  mono: "var(--font-mono), ui-monospace, monospace",
};

export interface Tokens {
  name: string;
  tagline: string;
}

export function fillTokens(text: string, tokens: Tokens) {
  return text.replace(/\{name\}/g, tokens.name).replace(/\{tagline\}/g, tokens.tagline);
}

export function backgroundCss(bg: Background): React.CSSProperties {
  if (bg.type === "gradient") return { background: `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})` };
  if (bg.type === "image" && bg.image)
    return { backgroundColor: bg.color, backgroundImage: `url("${bg.image}")`, backgroundSize: "cover", backgroundPosition: "center" };
  return { background: bg.color };
}

const shadowCss = (s?: Shadow) => (s && (s.x || s.y) ? `${s.x}px ${s.y}px 0 0 ${s.color}` : undefined);

function QrArt({ el }: { el: QrElement }) {
  const path = useMemo(() => {
    try {
      const qr = QRCode.create(el.value || " ", { errorCorrectionLevel: "M" });
      const n = qr.modules.size;
      let d = "";
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      return { d, n };
    } catch {
      return { d: "", n: 21 };
    }
  }, [el.value]);
  return (
    <svg viewBox={`-1 -1 ${path.n + 2} ${path.n + 2}`} width="100%" height="100%" shapeRendering="crispEdges">
      {el.background !== "transparent" && <rect x={-1} y={-1} width={path.n + 2} height={path.n + 2} fill={el.background} />}
      <path d={path.d} fill={el.color} />
    </svg>
  );
}

/** One element's visual, filling its box. */
export function ElementArt({ el, lang, tokens }: { el: CardElement; lang: Lang; tokens: Tokens }) {
  switch (el.type) {
    case "text": {
      const raw = (lang === "en" ? el.text_en || el.text_ko : el.text_ko || el.text_en) ?? "";
      const justify = el.vAlign === "middle" ? "center" : el.vAlign === "bottom" ? "flex-end" : "flex-start";
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: justify,
            fontFamily: FONT_STACK[el.font],
            fontSize: el.size,
            fontWeight: el.weight,
            fontStyle: el.italic ? "italic" : "normal",
            color: el.color,
            textAlign: el.align,
            letterSpacing: `${el.letterSpacing}em`,
            lineHeight: el.lineHeight,
            textTransform: el.uppercase ? "uppercase" : "none",
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
          }}
        >
          {fillTokens(raw, tokens)}
        </div>
      );
    }
    case "shape": {
      if (el.shape === "line") {
        return (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", height: Math.max(1, el.strokeWidth), background: el.stroke, borderRadius: el.radius }} />
          </div>
        );
      }
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: el.fill,
            border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
            borderRadius: el.shape === "ellipse" ? "50%" : el.radius,
            boxShadow: shadowCss(el.shadow),
            boxSizing: "border-box",
          }}
        />
      );
    }
    case "image":
      return el.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={el.src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: el.fit,
            borderRadius: el.radius,
            border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
            boxShadow: shadowCss(el.shadow),
            filter: el.grayscale ? "grayscale(1)" : undefined,
            boxSizing: "border-box",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: el.radius,
            border: `2px dashed ${el.stroke || "#999"}`,
            background: "repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0 12px, transparent 12px 24px)",
            boxSizing: "border-box",
          }}
        />
      );
    case "qr":
      return <QrArt el={el} />;
  }
}

/** The generated paper tile for a kind (null until ready, or for "none"). */
export function usePaperTexture(kind: PaperKind) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (kind === "none") {
      setUrl(null);
      return;
    }
    let live = true;
    const run = () => void paperTexture(kind).then((u) => live && setUrl(u));
    // generating takes a few frames of CPU; keep it off the first paint
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback?.(run, { timeout: 700 });
    const timer = idle === undefined ? window.setTimeout(run, 80) : undefined;
    return () => {
      live = false;
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [kind]);
  return url;
}

/**
 * A face (background + elements) in card units. `p` = scroll progress or null
 * for the base pose; `settle` blends the motion back to the base pose.
 */
export function FaceArt({
  card,
  face,
  lang,
  tokens,
  p,
  settle = 0,
  links = false,
  renderOverlay,
}: {
  card: CardDesign;
  face: FaceKey;
  lang: Lang;
  tokens: Tokens;
  p: number | null;
  settle?: number;
  links?: boolean;
  renderOverlay?: (el: CardElement) => React.ReactNode;
}) {
  const f = card[face];
  const texture = usePaperTexture(card.paper.texture);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: card.radius,
        ...backgroundCss(f.background),
      }}
    >
      {f.elements.map((el) => {
        if (el.hidden) return null;
        const art = <ElementArt el={el} lang={lang} tokens={tokens} />;
        const style = elementStyle(el, p, settle);
        if (links && el.link) {
          const external = /^https?:/i.test(el.link);
          return (
            <a
              key={el.id}
              href={el.link}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              style={{ ...style, display: "block", cursor: "pointer" }}
              className="card-link"
            >
              {art}
            </a>
          );
        }
        return (
          <div key={el.id} style={style} data-el={el.id}>
            {art}
            {renderOverlay?.(el)}
          </div>
        );
      })}
      {texture && card.paper.amount > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${texture}")`,
            backgroundSize: `${PAPER_TILE}px ${PAPER_TILE}px`,
            opacity: Math.min(1, card.paper.amount),
            pointerEvents: "none",
          }}
        />
      )}
      {card.borderWidth > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: card.radius,
            border: `${card.borderWidth}px solid ${card.borderColor}`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

/** Measures its own width and exposes the card-units → px scale. */
export function useFitScale(cardWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / cardWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardWidth]);
  return { ref, scale };
}
