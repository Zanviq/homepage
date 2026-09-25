import type { CardDesign, CardElement, Keyframe } from "./types";

export const IDENTITY: Omit<Keyframe, "at"> = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Offsets for an element at scroll progress p (eased between keyframes). */
export function sampleMotion(motion: Keyframe[], p: number): Omit<Keyframe, "at"> {
  if (!motion.length) return IDENTITY;
  const ks = [...motion].sort((a, b) => a.at - b.at);
  if (p <= ks[0].at) return ks[0];
  const last = ks[ks.length - 1];
  if (p >= last.at) return last;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (p >= a.at && p <= b.at) {
      const t = smooth(a.at, b.at, p);
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        rotate: lerp(a.rotate, b.rotate, t),
        scale: lerp(a.scale, b.scale, t),
        opacity: lerp(a.opacity, b.opacity, t),
      };
    }
  }
  return last;
}

/**
 * CSS for an element at progress p (null = static base pose). `settle` 0..1
 * blends the scroll motion back to the designed pose (the floating card).
 */
export function elementStyle(el: CardElement, p: number | null, settle = 0): React.CSSProperties {
  let m = p === null ? IDENTITY : sampleMotion(el.motion, p);
  if (settle > 0 && p !== null) {
    const k = clamp01(settle);
    m = {
      x: lerp(m.x, 0, k),
      y: lerp(m.y, 0, k),
      rotate: lerp(m.rotate, 0, k),
      scale: lerp(m.scale, 1, k),
      opacity: lerp(m.opacity, 1, k),
    };
  }
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    opacity: el.opacity * m.opacity,
    transform: `translate(${m.x}px, ${m.y}px) rotate(${el.rotation + m.rotate}deg) scale(${m.scale})`,
    transformOrigin: "50% 50%",
  };
}

export interface CardPose {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
}

/** Whole-card pose at progress p: tilt while scrolling, flip to the back. */
export function cardPose(card: CardDesign, p: number): CardPose {
  const s = card.scroll;
  const flip = s.flip ? 180 * smooth(s.flipStart, s.flipEnd, p) : 0;
  // tilt rises in, eases through the flip and settles by the end
  const tiltEnv = Math.sin(Math.PI * clamp01(p));
  return {
    rotateX: s.tilt * (0.6 - p) * 0.9 * (0.4 + tiltEnv * 0.6),
    rotateY: flip + s.tilt * 0.6 * tiltEnv * (s.flip ? 0.4 : 1),
    rotateZ: -s.tilt * 0.25 * (1 - smooth(0, 0.5, p)),
    scale: lerp(s.scaleFrom, s.scaleTo, smooth(0, 0.35, p)),
  };
}

/** Which face is towards the viewer for a given Y rotation. */
export function faceAt(rotateY: number): "front" | "back" {
  const a = ((rotateY % 360) + 360) % 360;
  return a > 90 && a < 270 ? "back" : "front";
}

// Light from the upper left, slightly in front (CSS axes: +y down, +z to the viewer).
const LIGHT = (() => {
  const v = [-0.38, -0.5, 0.78];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n) as [number, number, number];
})();

export interface FaceLight {
  /** >0 brighten, <0 darken, relative to lying flat. */
  tone: number;
  /** Highlight centre on the face, 0..100 %. */
  hx: number;
  hy: number;
}

/** Diffuse light on one face of a card posed with rotateX(a) rotateY(b) (degrees). */
export function faceLight(rotateX: number, rotateY: number, face: "front" | "back"): FaceLight {
  const a = (rotateX * Math.PI) / 180;
  const b = (rotateY * Math.PI) / 180;
  // normal of the front face after rotateX(a) rotateY(b); rotateZ leaves it alone
  const s = face === "front" ? 1 : -1;
  const n = [s * Math.sin(b), -s * Math.cos(b) * Math.sin(a), s * Math.cos(b) * Math.cos(a)];
  const lit = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  // the highlight slides opposite to the turn, as a reflection would
  const turn = face === "front" ? Math.sin(b) : -Math.sin(b);
  return {
    tone: lit - LIGHT[2],
    hx: 30 - turn * 70,
    hy: 22 + Math.sin(a) * 70,
  };
}
