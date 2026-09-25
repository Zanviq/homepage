"use client";

import { useEffect, useRef, useState } from "react";
import { cardPose, visibleFace } from "@/lib/card/motion";
import type { CardDesign } from "@/lib/card/types";
import type { Lang } from "@/lib/types";
import { FaceArt, type Tokens } from "./CardArt";

/**
 * Home hero: the business card sits in a sticky stage; scrolling through the
 * stage drives its pose (tilt, flip to the back) and every element's motion.
 */
export function CardStage({ card, lang, tokens, scrollLabel }: { card: CardDesign; lang: Lang; tokens: Tokens; scrollLabel: string }) {
  const stage = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [hover, setHover] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      setP(Math.min(1, Math.max(0, -r.top / span)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // ease the hover tilt toward the pointer
  useEffect(() => {
    if (reduced || !card.scroll.hoverTilt) return;
    let raf = 0;
    const loop = () => {
      setHover((h) => {
        const nx = h.x + (target.current.x - h.x) * 0.12;
        const ny = h.y + (target.current.y - h.y) * 0.12;
        return Math.abs(nx - h.x) < 0.001 && Math.abs(ny - h.y) < 0.001 ? h : { x: nx, y: ny };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, card.scroll.hoverTilt]);

  const aspect = card.width / card.height;
  const widthCss = `min(90vw, 920px, calc(70svh * ${aspect.toFixed(4)}))`;

  if (reduced) {
    // no scroll choreography: both faces, side by side / stacked, in their designed pose
    return (
      <section className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-5 py-16 lg:flex-row lg:justify-center">
          {(["front", ...(card.scroll.flip ? (["back"] as const) : [])] as const).map((face) => (
            <StaticFace key={face} card={card} face={face} lang={lang} tokens={tokens} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={stage}
      className="relative border-b-2 border-ink"
      style={{ height: `${Math.max(1.2, card.scroll.length) * 100}svh` }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        target.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 };
      }}
      onPointerLeave={() => (target.current = { x: 0, y: 0 })}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pt-14">
        <Card3D card={card} p={p} hover={hover} lang={lang} tokens={tokens} width={widthCss} links />
        <span
          aria-hidden
          className="mt-10 font-mono text-xs uppercase tracking-widest text-ink-soft transition-opacity"
          style={{ opacity: Math.max(0, 1 - p * 5) }}
        >
          {scrollLabel} ↓
        </span>
      </div>
    </section>
  );
}

/** The card in 3D at scroll progress p (used by the home stage and the editor preview). */
export function Card3D({
  card,
  p,
  hover = { x: 0, y: 0 },
  lang,
  tokens,
  width,
  links = false,
}: {
  card: CardDesign;
  p: number;
  hover?: { x: number; y: number };
  lang: Lang;
  tokens: Tokens;
  width: string;
  links?: boolean;
}) {
  const pose = cardPose(card, p);
  const showing = visibleFace(card, p);
  const frame = (): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: card.radius,
    boxShadow: card.shadow.x || card.shadow.y ? `${card.shadow.x}px ${card.shadow.y}px 0 0 ${card.shadow.color}` : undefined,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  });
  return (
    <div style={{ width, perspective: "1800px" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${card.width} / ${card.height}`,
          transformStyle: "preserve-3d",
          transform: `rotateX(${pose.rotateX - hover.y * 6}deg) rotateY(${pose.rotateY + hover.x * 8}deg) rotateZ(${pose.rotateZ}deg) scale(${pose.scale})`,
          willChange: "transform",
        }}
      >
        <ScaledFace card={card} face="front" lang={lang} tokens={tokens} p={p} frame={frame()} interactive={links && showing === "front"} />
        {card.scroll.flip && (
          <ScaledFace
            card={card}
            face="back"
            lang={lang}
            tokens={tokens}
            p={p}
            // card (180°) + face (180°) = 360°: the back ends up facing the viewer unmirrored
            frame={{ ...frame(), transform: "rotateY(180deg)" }}
            interactive={links && showing === "back"}
          />
        )}
      </div>
    </div>
  );
}

function ScaledFace({
  card,
  face,
  lang,
  tokens,
  p,
  frame,
  interactive,
}: {
  card: CardDesign;
  face: "front" | "back";
  lang: Lang;
  tokens: Tokens;
  p: number;
  frame: React.CSSProperties;
  interactive: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / card.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card.width]);
  return (
    <div ref={box} style={{ ...frame, pointerEvents: interactive ? "auto" : "none" }} aria-hidden={!interactive}>
      <div style={{ position: "absolute", left: 0, top: 0, width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <FaceArt card={card} face={face} lang={lang} tokens={tokens} p={p} links={interactive} />
      </div>
    </div>
  );
}

function StaticFace({ card, face, lang, tokens }: { card: CardDesign; face: "front" | "back"; lang: Lang; tokens: Tokens }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / card.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [card.width]);
  return (
    <div
      ref={box}
      style={{
        position: "relative",
        width: "min(90vw, 560px)",
        aspectRatio: `${card.width} / ${card.height}`,
        borderRadius: card.radius,
        boxShadow: `${card.shadow.x}px ${card.shadow.y}px 0 0 ${card.shadow.color}`,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <FaceArt card={card} face={face} lang={lang} tokens={tokens} p={null} links />
      </div>
    </div>
  );
}
