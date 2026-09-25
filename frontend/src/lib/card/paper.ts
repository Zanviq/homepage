import type { PaperKind } from "./types";

// Procedural card-stock texture, generated once per kind in the browser.
// A tileable height field (grain + fibres, or a plain weave for linen) is lit
// from the upper left; the result is white where the tooth catches the light
// and dark where it falls away, with alpha = strength, so it reads on light
// and dark faces alike without blend modes.

export const PAPER_TILE = 512;

interface Recipe {
  seed: number;
  /** [cells across the tile, amplitude] octaves of grain */
  grain: [number, number][];
  fibres: { count: number; len: [number, number]; width: [number, number]; weight: number };
  weave?: boolean;
  /** relief steepness and output gain */
  bump: number;
  gain: number;
  /** large, soft cloudiness of the pulp (unlit) */
  mottle: number;
}

const RECIPES: Record<Exclude<PaperKind, "none">, Recipe> = {
  paper: {
    seed: 11,
    grain: [
      [256, 0.45],
      [128, 0.35],
      [64, 0.2],
      [16, 0.1],
    ],
    fibres: { count: 240, len: [6, 24], width: [0.5, 1], weight: 0.45 },
    bump: 0.55,
    gain: 0.8,
    mottle: 0.03,
  },
  cotton: {
    seed: 23,
    grain: [
      [128, 0.3],
      [64, 0.45],
      [32, 0.35],
      [8, 0.2],
    ],
    fibres: { count: 600, len: [12, 55], width: [0.6, 1.4], weight: 0.5 },
    bump: 0.5,
    gain: 0.85,
    mottle: 0.06,
  },
  linen: {
    seed: 37,
    grain: [
      [256, 0.12],
      [64, 0.1],
    ],
    fibres: { count: 80, len: [10, 30], width: [0.5, 0.9], weight: 0.2 },
    weave: true,
    bump: 0.6,
    gain: 0.7,
    mottle: 0.03,
  },
};

const cache = new Map<PaperKind, Promise<string | null>>();

/** Object URL of a PAPER_TILE² texture tile (null for "none" or on the server). */
export function paperTexture(kind: PaperKind): Promise<string | null> {
  if (kind === "none" || typeof document === "undefined") return Promise.resolve(null);
  let p = cache.get(kind);
  if (!p) {
    p = build(RECIPES[kind]).catch(() => null);
    cache.set(kind, p);
  }
  return p;
}

function rng(seed: number) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds tileable value noise (cx × cy lattice cells across the tile) into `out`. */
function addNoise(out: Float32Array, T: number, cx: number, cy: number, amp: number, rand: () => number) {
  const lat = new Float32Array(cx * cy);
  for (let i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
  for (let y = 0; y < T; y++) {
    const fy = (y / T) * cy;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % cy) * cx;
    const r1 = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < T; x++) {
      const fx = (x / T) * cx;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % cx;
      const c1 = (x0 + 1) % cx;
      const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
      const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
      out[y * T + x] += (a + (b - a) * sy) * amp;
    }
  }
}

/** Short curved strokes, wrapped so the tile stays seamless. Returns coverage 0..1. */
function fibreMap(T: number, f: Recipe["fibres"], rand: () => number) {
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const g = c.getContext("2d");
  if (!g) return new Float32Array(T * T);
  g.lineCap = "round";
  for (let i = 0; i < f.count; i++) {
    const x = rand() * T;
    const y = rand() * T;
    const ang = rand() * Math.PI * 2;
    const len = f.len[0] + rand() * (f.len[1] - f.len[0]);
    const bend = (rand() - 0.5) * len * 0.7;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const mx = (x + x2) / 2 - Math.sin(ang) * bend;
    const my = (y + y2) / 2 + Math.cos(ang) * bend;
    g.lineWidth = f.width[0] + rand() * (f.width[1] - f.width[0]);
    g.strokeStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
    for (const ox of [-T, 0, T])
      for (const oy of [-T, 0, T]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(mx + ox, my + oy, x2 + ox, y2 + oy);
        g.stroke();
      }
  }
  const px = g.getImageData(0, 0, T, T).data;
  const out = new Float32Array(T * T);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3] / 255;
  return out;
}

async function build(r: Recipe): Promise<string | null> {
  const T = PAPER_TILE;
  const rand = rng(r.seed);
  const h = new Float32Array(T * T);
  for (const [cells, amp] of r.grain) addNoise(h, T, cells, cells, amp, rand);

  if (r.weave) {
    // plain weave, 4 px threads; thickness wanders along each thread
    const warp = new Float32Array(T * T);
    const weft = new Float32Array(T * T);
    addNoise(warp, T, T / 4, 24, 1, rand);
    addNoise(weft, T, 24, T / 4, 1, rand);
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const i = y * T + x;
        const wp = Math.sin((Math.PI * ((x % 4) + 0.5)) / 4) * (0.8 + 0.25 * warp[i]);
        const wf = Math.sin((Math.PI * ((y % 4) + 0.5)) / 4) * (0.8 + 0.25 * weft[i]);
        const over = ((x >> 2) + (y >> 2)) & 1;
        h[i] += over ? wp * 0.75 + wf * 0.2 : wf * 0.75 + wp * 0.2;
      }
  }

  const fib = fibreMap(T, r.fibres, rand);
  for (let i = 0; i < h.length; i++) h[i] += fib[i] * r.fibres.weight;

  const mottle = new Float32Array(T * T);
  addNoise(mottle, T, 4, 4, 0.6, rand);
  addNoise(mottle, T, 10, 10, 0.4, rand);

  // light from the upper left
  let lx = -0.55,
    ly = -0.65,
    lz = 0.52;
  const ln = Math.hypot(lx, ly, lz);
  lx /= ln;
  ly /= ln;
  lz /= ln;

  const img = new ImageData(T, T);
  const d = img.data;
  for (let y = 0; y < T; y++) {
    const yu = ((y - 1 + T) % T) * T;
    const yd = ((y + 1) % T) * T;
    for (let x = 0; x < T; x++) {
      const xl = (x - 1 + T) % T;
      const xr = (x + 1) % T;
      const gx = (h[y * T + xr] - h[y * T + xl]) * r.bump;
      const gy = (h[yd + x] - h[yu + x]) * r.bump;
      const lit = (-gx * lx - gy * ly + lz) / Math.hypot(gx, gy, 1);
      const v = (lit - lz) * r.gain + mottle[y * T + x] * r.mottle;
      const o = (y * T + x) * 4;
      if (v >= 0) {
        d[o] = 255;
        d[o + 1] = 252;
        d[o + 2] = 244;
      } else {
        d[o] = 44;
        d[o + 1] = 34;
        d[o + 2] = 20;
      }
      d[o + 3] = Math.min(255, Math.abs(v) * 255);
    }
  }

  const c = document.createElement("canvas");
  c.width = c.height = T;
  const g = c.getContext("2d");
  if (!g) return null;
  g.putImageData(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}
