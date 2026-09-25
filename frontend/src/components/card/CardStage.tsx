"use client";

import { useEffect, useRef, useState } from "react";
import { cardPose, faceAt, faceLight, type CardPose, type FaceLight } from "@/lib/card/motion";
import type { CardDesign, FaceKey } from "@/lib/card/types";
import type { Lang } from "@/lib/types";
import { FaceArt, type Tokens } from "./CardArt";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const win = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Flight time between the hero and the corner. */
const DOCK_MS = 900;

interface Frame {
  p: number; // stage progress (smoothed scroll)
  t: number; // 0 = hero, 1 = docked in the corner (linear in time)
  spin: number; // extra Y rotation from clicking the docked card
  lift: number; // 0..1 while a click flip is under way
  hx: number; // hover tilt, -1..1
  hy: number;
  hov: number; // pointer over the docked card, eased 0..1
  press: number;
  exit: number; // px the card has scrolled away (corner card turned off)
}

const REST: Frame = { p: 0, t: 0, spin: 0, lift: 0, hx: 0, hy: 0, hov: 0, press: 0, exit: 0 };

function same(a: Frame, b: Frame) {
  for (const k in a) if (Math.abs(a[k as keyof Frame] - b[k as keyof Frame]) > 1e-4) return false;
  return true;
}

/**
 * Home hero. The card lives in a fixed layer: while the stage scrolls by it
 * plays the choreography (tilt, flip, element motion); past the stage it
 * flies into the bottom-right corner and stays there as a small card that
 * flips over when clicked. Scrolling back up brings it home.
 */
export function CardStage({
  card,
  lang,
  tokens,
  scrollLabel,
  flipLabel,
}: {
  card: CardDesign;
  lang: Lang;
  tokens: Tokens;
  scrollLabel: string;
  flipLabel: string;
}) {
  const stage = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [f, setF] = useState<Frame>(REST);
  const [docked, setDocked] = useState(false);
  const [geo, setGeo] = useState({ dx: 0, dy: 0, s: 0.3 });
  const [reduced, setReduced] = useState(false);
  const settings = useRef(card.scroll);
  const sim = useRef({
    init: false,
    ys: 0,
    t: 0,
    docked: false,
    spin: 0,
    spinV: 0,
    spinTo: 0,
    hx: 0,
    hy: 0,
    tx: 0,
    ty: 0,
    hov: 0,
    hovTo: 0,
    press: 0,
    pressTo: 0,
  });

  useEffect(() => {
    settings.current = card.scroll;
  }, [card.scroll]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // where the corner card sits, relative to the hero slot
  useEffect(() => {
    if (reduced) return;
    const L = layer.current;
    const S = slot.current;
    if (!L || !S) return;
    const measure = () => {
      const vw = L.clientWidth;
      const vh = L.clientHeight;
      const r = S.getBoundingClientRect();
      const aspect = card.width / card.height;
      const long = Math.min(card.scroll.dockWidth, vw * 0.38);
      const w = aspect >= 1 ? long : long * aspect;
      const h = w / aspect;
      const m = vw < 640 ? 14 : 28;
      const cx = vw - m - w / 2 - 4;
      const cy = vh - m - h / 2 - 4;
      setGeo({ dx: cx - (r.left + r.width / 2), dy: cy - (r.top + r.height / 2), s: w / Math.max(1, r.width) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(L);
    ro.observe(S);
    return () => ro.disconnect();
  }, [reduced, card.width, card.height, card.scroll.dockWidth]);

  // one loop drives scroll smoothing, the dock flight, the flip spring and hover
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    let prev = REST;
    let prevDocked = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const el = stage.current;
      const L = layer.current;
      if (!el || !L) return;
      const s = sim.current;
      const sc = settings.current;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const y = window.scrollY;
      const vh = L.clientHeight || window.innerHeight;
      const top = el.getBoundingClientRect().top + y;
      const span = Math.max(1, el.offsetHeight - vh);
      const past = y - (top + span); // px scrolled beyond the stage

      if (!sc.dock) s.docked = false;
      else if (!s.docked && past > vh * 0.05) s.docked = true;
      else if (s.docked && past < -vh * 0.02) s.docked = false;

      if (!s.init) {
        // arriving mid-page (reload, back button): no flight, just be there
        s.init = true;
        s.ys = y;
        s.t = s.docked ? 1 : 0;
      }

      const tau = 0.02 + clamp01(sc.smoothing) * 0.3;
      s.ys += (y - s.ys) * (1 - Math.exp(-dt / tau));
      if (Math.abs(y - s.ys) < 0.3) s.ys = y;
      const p = clamp01((s.ys - top) / span);

      const step = (dt * 1000) / DOCK_MS;
      s.t = s.docked ? Math.min(1, s.t + step) : Math.max(0, s.t - step);

      // leaving the corner undoes click flips (to the nearest whole turn)
      if (!s.docked) s.spinTo = Math.round(s.spinTo / 360) * 360;
      const w = 9;
      const z = 0.62;
      s.spinV += (w * w * (s.spinTo - s.spin) - 2 * z * w * s.spinV) * dt;
      s.spin += s.spinV * dt;
      if (Math.abs(s.spinTo - s.spin) < 0.05 && Math.abs(s.spinV) < 0.05) {
        s.spin = s.spinTo;
        s.spinV = 0;
      }
      const lift = Math.sin(Math.PI * clamp01(1 - Math.abs(s.spinTo - s.spin) / 180));

      if (s.docked && s.hovTo === 0) {
        s.tx = 0;
        s.ty = 0;
      }
      const kh = 1 - Math.exp(-dt / 0.12);
      s.hx += ((sc.hoverTilt ? s.tx : 0) - s.hx) * kh;
      s.hy += ((sc.hoverTilt ? s.ty : 0) - s.hy) * kh;
      s.hov += (s.hovTo - s.hov) * (1 - Math.exp(-dt / 0.1));
      s.press += (s.pressTo - s.press) * (1 - Math.exp(-dt / 0.05));

      const next: Frame = {
        p,
        t: s.t,
        spin: s.spin,
        lift,
        hx: s.hx,
        hy: s.hy,
        hov: s.hov,
        press: s.press,
        exit: sc.dock ? 0 : Math.max(0, past),
      };
      if (!same(prev, next)) {
        prev = next;
        setF(next);
      }
      if (s.docked !== prevDocked) {
        prevDocked = s.docked;
        setDocked(s.docked);
      }
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      const s = sim.current;
      if (e.pointerType !== "mouse" || s.docked) return;
      s.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      s.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

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

  const flip = () => {
    sim.current.spinTo += 180;
  };

  const { t } = f;
  const base = cardPose(card, f.p);
  const endsOnBack = faceAt(cardPose(card, 1).rotateY) === "back";
  const arc = Math.sin(Math.PI * t);
  const tilt = lerp(1, 1.8, t); // the small card leans harder toward the pointer
  const pose: CardPose = {
    rotateX: base.rotateX * (1 - t) + arc * 14 - f.hy * 6 * tilt,
    // in flight it keeps turning the same way, landing on the front
    rotateY: base.rotateY + (endsOnBack ? 180 * ease(win(t, 0.12, 0.85)) : 0) + f.spin + f.hx * 8 * tilt,
    rotateZ: lerp(base.rotateZ, -2.5 * (1 - f.hov), t) - arc * 10,
    scale: base.scale * (1 + 0.1 * f.lift + t * (0.05 * f.hov - 0.04 * f.press)),
  };
  const move = `translate3d(${geo.dx * ease(win(t, 0, 0.9))}px, ${geo.dy * ease(win(t, 0.1, 1)) - f.exit}px, 0) scale(${lerp(1, geo.s, ease(win(t, 0, 0.7)))})`;
  return (
    <section ref={stage} className="relative border-b-2 border-ink" style={{ height: `${Math.max(1.2, card.scroll.length) * 100}svh` }}>
      <div ref={layer} className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center px-4 pt-14">
        <div ref={slot} style={{ width: widthCss }}>
          <div
            role={docked ? "button" : undefined}
            tabIndex={docked ? 0 : -1}
            aria-label={docked ? flipLabel : undefined}
            title={docked ? flipLabel : undefined}
            className="card-dock pointer-events-auto"
            style={{
              transform: move,
              transformOrigin: "50% 50%",
              willChange: t > 0 && t < 1 ? "transform" : undefined,
              cursor: docked ? "pointer" : undefined,
            }}
            onClick={() => docked && flip()}
            onKeyDown={(e) => {
              if (docked && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                flip();
              }
            }}
            onPointerMove={(e) => {
              if (!docked || e.pointerType !== "mouse") return;
              const r = e.currentTarget.getBoundingClientRect();
              sim.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
              sim.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
              sim.current.hovTo = 1;
            }}
            onPointerLeave={() => {
              sim.current.hovTo = 0;
              sim.current.pressTo = 0;
            }}
            onPointerDown={() => {
              if (docked) sim.current.pressTo = 1;
            }}
            onPointerUp={() => (sim.current.pressTo = 0)}
          >
            <Card3D
              card={card}
              p={f.p}
              pose={pose}
              settle={ease(win(t, 0.05, 0.45))}
              lang={lang}
              tokens={tokens}
              width="100%"
              links={!docked && t === 0}
            />
          </div>
        </div>
        <span
          aria-hidden
          className="mt-10 font-mono text-xs uppercase tracking-widest text-ink-soft"
          style={{ opacity: Math.max(0, 1 - f.p * 5) * (1 - t) }}
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
  pose,
  settle = 0,
  hover = { x: 0, y: 0 },
  lang,
  tokens,
  width,
  links = false,
}: {
  card: CardDesign;
  p: number;
  /** Overrides the scroll pose (the home stage adds its own flight and flips). */
  pose?: CardPose;
  settle?: number;
  hover?: { x: number; y: number };
  lang: Lang;
  tokens: Tokens;
  width: string;
  links?: boolean;
}) {
  const b = pose ?? cardPose(card, p);
  const rx = b.rotateX - hover.y * 6;
  const ry = b.rotateY + hover.x * 8;
  const showing = faceAt(ry);
  const light = card.paper.light;
  return (
    <div style={{ width, perspective: "1800px" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${card.width} / ${card.height}`,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${b.rotateZ}deg) scale(${b.scale})`,
          willChange: "transform",
        }}
      >
        {(["front", "back"] as const).map((face) => (
          <ScaledFace
            key={face}
            card={card}
            face={face}
            lang={lang}
            tokens={tokens}
            p={p}
            settle={settle}
            interactive={links && showing === face}
            light={light > 0 ? faceLight(rx, ry, face) : null}
          />
        ))}
      </div>
    </div>
  );
}

function useFaceScale(cardWidth: number) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / cardWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardWidth]);
  return { box, scale };
}

function ScaledFace({
  card,
  face,
  lang,
  tokens,
  p,
  settle,
  interactive,
  light,
}: {
  card: CardDesign;
  face: FaceKey;
  lang: Lang;
  tokens: Tokens;
  p: number;
  settle: number;
  interactive: boolean;
  light: FaceLight | null;
}) {
  const { box, scale } = useFaceScale(card.width);
  const radius = card.radius * scale;
  const sh = card.shadow;
  const amt = card.paper.light;
  return (
    <div
      ref={box}
      aria-hidden={!interactive}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        boxShadow: sh.x || sh.y ? `${sh.x * scale}px ${sh.y * scale}px 0 0 ${sh.color}` : undefined,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        // card (180°) + face (180°) = 360°: the back ends up facing the viewer unmirrored
        transform: face === "back" ? "rotateY(180deg)" : undefined,
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <FaceArt card={card} face={face} lang={lang} tokens={tokens} p={p} settle={settle} links={interactive} />
      </div>
      {light && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            pointerEvents: "none",
            background: `radial-gradient(130% 100% at ${light.hx}% ${light.hy}%, rgba(255,250,240,${amt * (0.1 + Math.max(0, light.tone) * 0.7)}) 0%, rgba(255,250,240,0) 62%), rgba(14,10,4,${amt * Math.max(0, -light.tone) * 0.8})`,
          }}
        />
      )}
    </div>
  );
}

function StaticFace({ card, face, lang, tokens }: { card: CardDesign; face: FaceKey; lang: Lang; tokens: Tokens }) {
  const { box, scale } = useFaceScale(card.width);
  return (
    <div
      ref={box}
      style={{
        position: "relative",
        width: "min(90vw, 560px)",
        aspectRatio: `${card.width} / ${card.height}`,
        borderRadius: card.radius * scale,
        boxShadow: `${card.shadow.x * scale}px ${card.shadow.y * scale}px 0 0 ${card.shadow.color}`,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <FaceArt card={card} face={face} lang={lang} tokens={tokens} p={null} links />
      </div>
    </div>
  );
}
