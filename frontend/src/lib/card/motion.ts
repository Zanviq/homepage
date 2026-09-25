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

/** CSS for an element at progress p (null = static base pose). */
export function elementStyle(el: CardElement, p: number | null): React.CSSProperties {
  const m = p === null ? IDENTITY : sampleMotion(el.motion, p);
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

/** Which face is showing at progress p. */
export function visibleFace(card: CardDesign, p: number): "front" | "back" {
  if (!card.scroll.flip) return "front";
  return smooth(card.scroll.flipStart, card.scroll.flipEnd, p) > 0.5 ? "back" : "front";
}
