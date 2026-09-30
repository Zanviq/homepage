import * as THREE from "three";
import type { Lang } from "@/lib/types";
import type { Colliders } from "./collision";
import type { Pad, Terrain } from "./terrain";
import { ROAD_HALF } from "./constants";
import type { Track } from "./track";
import type { DriveContent, DriveProject, Poi } from "./types";

export const SIGN_GREEN = "#0b6a4b";
export const SIGN_BLUE = "#0a4fa3";
const WHITE = "#f4f4f0";

export interface Fonts {
  latin: string;
  korean: string;
}

const pick = (o: object, key: string, lang: Lang): string => {
  const r = o as Record<string, unknown>;
  return String(r[`${key}_${lang}`] || r[`${key}_en`] || r[`${key}_ko`] || "");
};
const plain = (s: string) => s.replace(/_(.+?)_/g, "($1)");

/** Year → timeline + qualification entries. */
export function entriesByYear(content: DriveContent) {
  const all = [...content.timeline, ...content.qualifications];
  const map = new Map<number, typeof all>();
  for (const e of all) {
    const y = parseInt(e.period, 10);
    if (!Number.isFinite(y)) continue;
    map.set(y, [...(map.get(y) ?? []), e]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

// ── canvas helpers ────────────────────────────────────────────────────────

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function signBase(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, r: number, inset: number, lw: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#2a2d31";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  rr(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = lw;
  rr(ctx, inset, inset, w - inset * 2, h - inset * 2, Math.max(4, r - inset * 0.7));
  ctx.stroke();
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number, fam: string) {
  let s = size;
  for (; s > 12; s -= 2) {
    ctx.font = `${weight} ${s}px ${fam}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return s;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  const hw = s * 0.4;
  const sw = s * 0.12;
  const hh = s * 0.44;
  ctx.moveTo(0, -s / 2);
  ctx.lineTo(hw, -s / 2 + hh);
  ctx.lineTo(sw, -s / 2 + hh);
  ctx.lineTo(sw, s / 2);
  ctx.lineTo(-sw, s / 2);
  ctx.lineTo(-sw, -s / 2 + hh);
  ctx.lineTo(-hw, -s / 2 + hh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function shield(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, fam: string) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.52);
  ctx.bezierCurveTo(x + w, y + h * 0.85, x + w * 0.7, y + h * 0.95, x + w / 2, y + h);
  ctx.bezierCurveTo(x + w * 0.3, y + h * 0.95, x, y + h * 0.85, x, y + h * 0.52);
  ctx.closePath();
  ctx.fillStyle = SIGN_BLUE;
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = w * 0.06;
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  fit(ctx, text, 800, h * 0.46, w * 0.8, fam);
  ctx.fillText(text, x + w / 2, y + h * 0.6);
  ctx.textAlign = "left";
}

// ── sign objects ──────────────────────────────────────────────────────────

/**
 * Every readable sign is built at this multiple of its original size, text
 * included; placement (road offsets, clearances, trigger ranges) follows.
 */
export const SIGN_SCALE = 2;
const S = SIGN_SCALE;

/** Inner edge of roadside signs, measured from the road centreline: clear of
 *  the shoulder, delineators (ROAD_HALF + 2.4) and lamp posts (ROAD_HALF + 2.9). */
const ROADSIDE_EDGE = ROAD_HALF + 3.3;

interface SignFace {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  draw: (lang: Lang) => void;
  material: THREE.MeshStandardMaterial;
  kind: "sign" | "board";
}

export interface SignSystem {
  group: THREE.Group;
  pois: Poi[];
  /** Arc lengths of the gantries spanning the road (keep lamps away from them). */
  gantries: number[];
  /** Ground the vegetation must leave free around signs and their sight lines. */
  clear: { x: number; z: number; r: number }[];
  setLang(lang: Lang): void;
  setGlow(signs: number, boards: number): void;
  ready: Promise<void>;
}

// Galvanised steel is dull: thin, shiny poles catch the low sun as tiny
// over-bright specks that bloom into halos, so keep these fairly rough.
const metalMat = new THREE.MeshStandardMaterial({ color: "#8a9096", metalness: 0.4, roughness: 0.68 });
const backMat = new THREE.MeshStandardMaterial({ color: "#8d949a", metalness: 0.35, roughness: 0.66 });
const darkMetal = new THREE.MeshStandardMaterial({ color: "#3a3f45", metalness: 0.4, roughness: 0.64 });

function facePanel(face: SignFace, w: number, h: number, depth = 0.14): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, depth);
  const mats = [backMat, backMat, backMat, backMat, face.material, backMat];
  const m = new THREE.Mesh(geo, mats);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeFace(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, lang: Lang) => void, kind: "sign" | "board" = "sign"): SignFace {
  const c = canvas(w, h);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: kind === "board" ? 0.62 : 0.5,
    metalness: 0,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: texture,
    emissiveIntensity: 0,
  });
  const face: SignFace = {
    canvas: c,
    texture,
    material,
    kind,
    draw: (lang) => {
      const ctx = c.getContext("2d")!;
      ctx.textBaseline = "alphabetic";
      draw(ctx, lang);
      texture.needsUpdate = true;
    },
  };
  return face;
}

/** Yaw that makes a plane's +z face point back along the road (toward drivers). */
function faceYaw(track: Track, i: number, turn = 0) {
  return Math.atan2(-track.tx[i], -track.tz[i]) + turn;
}

function post(h: number, w = 0.28) {
  const g = new THREE.BoxGeometry(w, h, w);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, metalMat);
  m.castShadow = true;
  return m;
}

/** World (x, z) of a point at local offset (dx, dz) of an object at (x, z) turned by yaw. */
function local(x: number, z: number, yaw: number, dx: number, dz: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x + c * dx + s * dz, z: z - s * dx + c * dz };
}

function coverUrl(url: string) {
  return url.startsWith("/api/media/") ? `${url}?w=1024` : url;
}

export function buildSigns(
  track: Track,
  terrain: Terrain,
  content: DriveContent,
  fonts: Fonts,
  pad: Pad,
  colliders: Colliders,
): SignSystem {
  const group = new THREE.Group();
  const faces: SignFace[] = [];
  const pois: Poi[] = [];
  const gantries: number[] = [];
  const clear: SignSystem["clear"] = [];
  const F = `${fonts.latin}, ${fonts.korean}, sans-serif`;
  const FK = `${fonts.korean}, ${fonts.latin}, sans-serif`;
  const fam = (lang: Lang) => (lang === "ko" ? FK : F);
  const years = entriesByYear(content);

  /** Highest ground under a panel of width w centred at (x, z), turned by yaw. */
  const groundUnder = (x: number, z: number, yaw: number, w: number) => {
    let h = -Infinity;
    for (let k = 0; k <= 6; k++) {
      const p = local(x, z, yaw, (k / 6 - 0.5) * w, 0);
      h = Math.max(h, terrain.heightAt(p.x, p.z));
    }
    return h;
  };
  /** A post at local (dx, dz) of a sign, standing on its own patch of ground and reaching world height `top`. */
  const leg = (x: number, z: number, yaw: number, dx: number, dz: number, top: number, w: number, sink = 0.2) => {
    const p = local(x, z, yaw, dx, dz);
    const ground = terrain.heightAt(p.x, p.z);
    const m = post(Math.max(0.5, top - ground + sink), w);
    m.position.set(p.x, ground - sink, p.z);
    m.rotation.y = yaw;
    group.add(m);
    return { m, x: p.x, z: p.z };
  };

  // ── layout along the road ──
  const GANTRY_S = 55;
  let s = 150;
  const yearStops: { year: number; s: number; entries: (typeof years)[number][1] }[] = [];
  for (const [year, entries] of years) {
    yearStops.push({ year, s, entries });
    s += 70 + entries.length * 13;
  }
  const timelineEnd = s;
  const projStart = Math.max(timelineEnd + 60, track.length * 0.4);
  const projEnd = track.length * 0.8;
  const projStep = (projEnd - projStart) / Math.max(1, content.projects.length - 1);

  // ── gantry helper: w × h panel over the road, its lower edge `clearance` above it ──
  const gantry = (si: number, w: number, h: number, face: SignFace, clearance: number) => {
    const i = track.indexAt(si);
    const yaw = faceYaw(track, i);
    const postW = 0.34 * S;
    const beamT = 0.22 * S;
    // posts just outside the panel's ends, never on the shoulder
    const span = Math.max(ROAD_HALF + 2.2, w / 2 + postW);
    const y0 = track.py[i];
    // stay clear of rising ground at the panel's ends (and always of the car)
    const lift = Math.max(clearance, groundUnder(track.px[i], track.pz[i], yaw, w) - y0 + 1.5);
    const topY = lift + h;
    for (const side of [1, -1]) {
      const p = leg(track.px[i], track.pz[i], yaw, span * side, 0, y0 + topY + 0.2, postW);
      colliders.addCircle(p.x, p.z, postW * 0.75, "sign");
    }
    // truss beams across, just behind the panel against the posts
    const beamLen = span * 2 + postW;
    for (const dy of [lift + beamT, lift + h - beamT]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(beamLen, beamT, beamT), metalMat);
      b.castShadow = true;
      b.position.set(track.px[i], y0 + dy, track.pz[i]);
      b.rotation.y = yaw;
      b.translateZ(-(postW + beamT) / 2);
      group.add(b);
    }
    const panel = facePanel(face, w, h, 0.14 * S);
    panel.position.set(track.px[i], y0 + lift + h / 2, track.pz[i]);
    panel.rotation.y = yaw;
    group.add(panel);
    gantries.push(si);
    // trees keep off the ends: crowns are several metres wide
    clear.push({ x: track.px[i], z: track.pz[i], r: span + 10 });
    return i;
  };

  // ── start gantry ──
  const startFace = makeFace(2048, 900, (ctx, lang) => {
    const w = 2048;
    const h = 900;
    signBase(ctx, w, h, SIGN_GREEN, 40, 22, 10);
    ctx.fillStyle = WHITE;
    shield(ctx, 90, 86, 170, 190, "zv", F);
    ctx.fillStyle = WHITE;
    const ns = fit(ctx, content.name, 800, 200, w - 400, F);
    ctx.fillText(content.name, 320, 86 + ns * 0.82);
    ctx.font = `600 ${lang === "ko" ? 74 : 80}px ${fam(lang)}`;
    ctx.globalAlpha = 0.95;
    ctx.fillText(pick(content, "tagline", lang), 324, 86 + ns * 0.82 + 100);
    ctx.globalAlpha = 0.8;
    ctx.font = `600 54px ${F}`;
    ctx.textAlign = "right";
    ctx.fillText("www.zanviq.dev", w - 84, 86 + ns * 0.82 + 98);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
    const top = Math.round(h * 0.56);
    ctx.fillRect(22, top, w - 44, 10);
    const km = (d: number) => `${(d / 1000).toFixed(1)} km`;
    const cols = [
      { ko: "연혁", en: "Timeline", d: yearStops[0]?.s ?? 150 },
      { ko: "프로젝트", en: "Projects", d: projStart },
      { ko: "전망대", en: "Lookout", d: track.nearest(pad.x, pad.z).s },
    ];
    const cw = (w - 44) / 3;
    cols.forEach((c, k) => {
      const x = 22 + k * cw;
      if (k) ctx.fillRect(x - 4, top, 8, h - top - 22);
      ctx.fillStyle = WHITE;
      arrow(ctx, x + 100, top + (h - top) / 2, 160, 0);
      const main = lang === "ko" ? c.ko : c.en;
      const sub = lang === "ko" ? c.en : c.ko;
      const ms = fit(ctx, main, 800, 100, cw - 230, fam(lang));
      ctx.fillText(main, x + 190, top + 40 + ms * 0.85);
      ctx.font = `600 50px ${lang === "ko" ? F : FK}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(sub, x + 192, top + 40 + ms * 0.85 + 68);
      ctx.globalAlpha = 1;
      ctx.font = `700 58px ${F}`;
      ctx.textAlign = "right";
      ctx.fillText(km(c.d - GANTRY_S), x + cw - 36, h - 58);
      ctx.textAlign = "left";
    });
  });
  faces.push(startFace);
  const g0 = gantry(GANTRY_S, 12.4 * S, 5.45 * S, startFace, 6.2);
  pois.push({ id: "start", kind: "start", s: GANTRY_S, x: track.px[g0], z: track.pz[g0], reach: 24 * S });

  // ── year gantries + entry plates ──
  for (const ys of yearStops) {
    const face = makeFace(1400, 620, (ctx, lang) => {
      const w = 1400;
      const h = 620;
      signBase(ctx, w, h, SIGN_BLUE, 30, 14, 7);
      ctx.fillStyle = WHITE;
      ctx.font = `800 230px ${F}`;
      ctx.fillText(String(ys.year), 60, h * 0.5 + 84);
      const x = 700;
      ctx.fillRect(x - 38, 46, 7, h - 92);
      ctx.font = `800 76px ${fam(lang)}`;
      ctx.fillText(lang === "ko" ? "연혁" : "Timeline", x, 196);
      ctx.font = `600 48px ${fam(lang)}`;
      ctx.globalAlpha = 0.9;
      const n = ys.entries.length;
      ctx.fillText(lang === "ko" ? `이력 ${n}건` : `${n} ${n === 1 ? "entry" : "entries"}`, x, 290);
      ctx.globalAlpha = 1;
      arrow(ctx, x + 44, 440, 96, 0);
    });
    faces.push(face);
    const gi = gantry(ys.s, 8.4 * S, 3.72 * S, face, 6.0);
    pois.push({
      id: `year-${ys.year}`,
      kind: "year",
      s: ys.s,
      x: track.px[gi],
      z: track.pz[gi],
      reach: 26 * S,
      year: ys.year,
      entries: ys.entries,
    });

    ys.entries.forEach((e, k) => {
      const side = k % 2 === 0 ? -1 : 1;
      const si = ys.s + 30 + k * 13;
      const i = track.indexAt(si);
      const pw = 2.9 * S;
      const ph = 1.9 * S;
      const turn = 0.22;
      const off = ROADSIDE_EDGE + (pw / 2) * Math.cos(turn);
      const x = track.px[i] + track.leftX(i) * off * side;
      const z = track.pz[i] + track.leftZ(i) * off * side;
      const yaw = faceYaw(track, i, side * turn);
      const bottom = groundUnder(x, z, yaw, pw) + 2.4;
      const plate = makeFace(760, 500, (ctx, lang) => {
        const w = 760;
        const h = 500;
        signBase(ctx, w, h, SIGN_GREEN, 26, 12, 6);
        ctx.fillStyle = WHITE;
        ctx.font = `700 40px ${F}`;
        ctx.globalAlpha = 0.85;
        ctx.fillText(e.period, 36, 78);
        ctx.globalAlpha = 1;
        const title = plain(pick(e, "title", lang));
        let size = 58;
        let lines: string[] = [];
        for (; size > 28; size -= 3) {
          ctx.font = `800 ${size}px ${fam(lang)}`;
          lines = wrap(ctx, title, w - 72);
          if (lines.length * size * 1.16 <= h - 200) break;
        }
        lines.forEach((l, q) => ctx.fillText(l, 36, 150 + q * size * 1.16));
        const org = pick(e, "org", lang);
        const desc = plain(pick(e, "desc", lang)).split("\n")[0];
        ctx.font = `500 34px ${fam(lang)}`;
        ctx.globalAlpha = 0.85;
        const sub = wrap(ctx, org || desc, w - 72).slice(0, 2);
        sub.forEach((l, q) => ctx.fillText(l, 36, h - 70 - (sub.length - 1 - q) * 42));
        ctx.globalAlpha = 1;
      });
      faces.push(plate);
      const depth = 0.08 * S;
      const panel = facePanel(plate, pw, ph, depth);
      panel.position.set(x, bottom + ph / 2, z);
      panel.rotation.y = yaw;
      group.add(panel);
      const postW = 0.09 * S;
      const legs = [-0.9 * S, 0.9 * S].map((dx) => leg(x, z, yaw, dx, -(depth + postW) / 2, bottom + ph / 2, postW));
      // one wall between the legs: the car can't squeeze under the plate
      colliders.addSegment(legs[0].x, legs[0].z, legs[1].x, legs[1].z, "sign");
      clear.push({ x, z, r: pw / 2 + 6 });
    });
  }

  // ── project billboards ──
  const images: Promise<void>[] = [];
  content.projects.forEach((p, k) => {
    const si = projStart + k * projStep;
    const i = track.indexAt(si);
    // put boards on the outside of the bend so they're in view
    const bend = track.curvature[i];
    const side = Math.abs(bend) > 0.002 ? (bend > 0 ? -1 : 1) : k % 2 ? 1 : -1;
    const W = 13.6 * S;
    const H = 9.35 * S;
    const turn = 0.42;
    // inner edge stays 6.8 m off the asphalt, as it was at the original size
    const off = ROAD_HALF + 6.8 + (W / 2) * Math.cos(turn);
    const x = track.px[i] + track.leftX(i) * off * side;
    const z = track.pz[i] + track.leftZ(i) * off * side;
    const yaw = faceYaw(track, i, side * turn);
    const img = new Image();
    let ok = false;
    images.push(
      new Promise((resolve) => {
        img.onload = () => {
          ok = true;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = coverUrl(p.cover);
      }),
    );
    const face = makeFace(
      1600,
      1100,
      (ctx, lang) => {
        const w = 1600;
        const h = 1100;
        ctx.fillStyle = "#15171a";
        ctx.fillRect(0, 0, w, h);
        const iw = w - 40;
        const ih = 860;
        if (ok) {
          const r = Math.max(iw / img.width, ih / img.height);
          const sw = iw / r;
          const sh = ih / r;
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 20, 20, iw, ih);
        } else {
          const gr = ctx.createLinearGradient(0, 0, w, ih);
          gr.addColorStop(0, "#56708a");
          gr.addColorStop(1, "#2c3a4a");
          ctx.fillStyle = gr;
          ctx.fillRect(20, 20, iw, ih);
          ctx.fillStyle = "rgba(244,244,240,.9)";
          ctx.font = `800 420px ${fam(lang)}`;
          ctx.textAlign = "center";
          ctx.fillText(pick(p, "title", lang).slice(0, 1), w / 2, 20 + ih / 2 + 150);
          ctx.textAlign = "left";
        }
        ctx.fillStyle = SIGN_BLUE;
        ctx.fillRect(0, 900, w, h - 900);
        ctx.fillStyle = WHITE;
        rr(ctx, 34, 934, 132, 132, 18);
        ctx.fill();
        ctx.fillStyle = SIGN_BLUE;
        ctx.font = `800 96px ${F}`;
        ctx.textAlign = "center";
        ctx.fillText(String(k + 1), 100, 1034);
        ctx.textAlign = "left";
        ctx.fillStyle = WHITE;
        const title = pick(p, "title", lang);
        const fs = fit(ctx, title, 800, 110, w - 420, fam(lang));
        ctx.fillText(title, 200, 1000 + fs * 0.36);
        ctx.font = `700 46px ${fam(lang)}`;
        ctx.textAlign = "right";
        ctx.globalAlpha = 0.9;
        ctx.fillText(lang === "ko" ? "E  자세히" : "E  Details", w - 44, 1016);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      },
      "board",
    );
    faces.push(face);
    // lifted off the ground at its centre, but never within 2 m of a slope under either end
    const bottom = Math.max(terrain.heightAt(x, z) + 3.4 * S, groundUnder(x, z, yaw, W) + 2);
    const panel = facePanel(face, W, H, 0.3 * S);
    panel.position.set(x, bottom + H / 2, z);
    panel.rotation.y = yaw;
    group.add(panel);
    // legs, catwalk and lamp arms
    for (const dx of [-W * 0.3, W * 0.3]) {
      const l = leg(x, z, yaw, dx, -0.5 * S, bottom + H * 0.6 - 0.5 * S, 0.45 * S, 0.5 * S);
      l.m.material = darkMetal;
      colliders.addCircle(l.x, l.z, 0.65, "sign");
    }
    const walk = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12 * S, 1.0 * S), darkMetal);
    walk.position.set(x, bottom - 0.1 * S, z);
    walk.rotation.y = yaw;
    walk.translateZ(0.5 * S);
    walk.castShadow = true;
    group.add(walk);
    for (let q = 0; q < 4; q++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5 * S, 0.22 * S, 0.3 * S), darkMetal);
      lamp.position.set(x, bottom - 0.05 * S, z);
      lamp.rotation.y = yaw;
      lamp.translateX(-W / 2 + (W * (q + 0.5)) / 4);
      lamp.translateZ(1.2 * S);
      group.add(lamp);
    }
    pois.push({ id: `project-${p.slug}`, kind: "project", s: si, x, z, reach: 38 * S, project: p });
    // the board and the view of it from the road
    clear.push({ x, z, r: 17 * S });
  });

  // ── lookout: about board + P sign ──
  {
    const face = makeFace(1800, 1100, (ctx, lang) => {
      const w = 1800;
      const h = 1100;
      signBase(ctx, w, h, SIGN_GREEN, 36, 18, 9);
      ctx.fillStyle = WHITE;
      ctx.font = `700 64px ${fam(lang)}`;
      ctx.globalAlpha = 0.9;
      ctx.fillText(lang === "ko" ? "전망대 · 소개" : "Lookout", 80, 128);
      ctx.globalAlpha = 1;
      const ns = fit(ctx, content.name, 800, 180, w - 160, F);
      ctx.fillText(content.name, 76, 150 + ns * 0.95);
      ctx.font = `600 64px ${fam(lang)}`;
      ctx.fillText(pick(content, "tagline", lang), 80, 150 + ns * 0.95 + 88);
      const top = 150 + ns * 0.95 + 140;
      ctx.fillRect(18, top, w - 36, 9);
      const about = pick(content, "about", lang)
        .replace(/[#*_`>]/g, "")
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ");
      ctx.font = `500 50px ${fam(lang)}`;
      const lines = wrap(ctx, about, w - 180).slice(0, 6);
      lines.forEach((l, q) => ctx.fillText(l, 84, top + 96 + q * 68));
      ctx.font = `700 50px ${F}`;
      const links = content.links.map((l) => l.url.replace(/^mailto:/, "").replace(/^https?:\/\//, "")).join("     ");
      ctx.globalAlpha = 0.9;
      ctx.fillText(links, 84, h - 64);
      ctx.globalAlpha = 1;
    });
    faces.push(face);
    const c = Math.cos(pad.angle);
    const sn = Math.sin(pad.angle);
    // far long edge of the pad, facing back toward the road
    const bx = pad.x + sn * (pad.hz - 1.5);
    const bz = pad.z + c * (pad.hz - 1.5);
    const aw = 10.8 * S;
    const ah = 6.6 * S;
    const yaw = pad.angle + Math.PI;
    const panel = facePanel(face, aw, ah, 0.25 * S);
    const centre = groundUnder(bx, bz, yaw, aw) + 2.2 + ah / 2;
    panel.position.set(bx, centre, bz);
    panel.rotation.y = yaw;
    group.add(panel);
    for (const dx of [-3.8 * S, 3.8 * S]) {
      const l = leg(bx, bz, yaw, dx, -0.2 * S, centre + 0.1 * S, 0.3 * S);
      colliders.addCircle(l.x, l.z, 0.35 * S, "sign");
    }
    pois.push({ id: "about", kind: "about", s: track.nearest(pad.x, pad.z).s, x: bx, z: bz, reach: 30 * S });
    clear.push({ x: bx, z: bz, r: 14 * S });

    const pFace = makeFace(512, 512, (ctx) => {
      signBase(ctx, 512, 512, SIGN_BLUE, 40, 14, 8);
      ctx.fillStyle = WHITE;
      ctx.font = `800 360px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText("P", 256, 390);
      ctx.textAlign = "left";
    });
    faces.push(pFace);
    const hit = track.nearest(pad.x, pad.z);
    const side = Math.sign(hit.lateral) || 1;
    const psi = hit.s - 60;
    const pi = track.indexAt(psi);
    const size = 1.4 * S;
    const pOff = ROADSIDE_EDGE + (size / 2) * Math.cos(0.2);
    const px = track.px[pi] + track.leftX(pi) * pOff * side;
    const pz = track.pz[pi] + track.leftZ(pi) * pOff * side;
    const pYaw = faceYaw(track, pi, 0.2 * side);
    const pBottom = groundUnder(px, pz, pYaw, size) + 2.2;
    const pDepth = 0.06 * S;
    const pPanel = facePanel(pFace, size, size, pDepth);
    pPanel.position.set(px, pBottom + size / 2, pz);
    pPanel.rotation.y = pYaw;
    group.add(pPanel);
    const pPostW = 0.09 * S;
    const pp = leg(px, pz, pYaw, 0, -(pDepth + pPostW) / 2, pBottom + size / 2, pPostW, 0.1);
    colliders.addCircle(pp.x, pp.z, 0.3, "pole");
    clear.push({ x: px, z: pz, r: size / 2 + 5 });
  }

  // ── chevrons on the outside of tight bends ──
  {
    const chev = makeFace(256, 320, (ctx) => {
      ctx.fillStyle = "#f2c31b";
      ctx.fillRect(0, 0, 256, 320);
      ctx.fillStyle = "#16181b";
      ctx.beginPath();
      ctx.moveTo(70, 40);
      ctx.lineTo(180, 160);
      ctx.lineTo(70, 280);
      ctx.lineTo(120, 280);
      ctx.lineTo(230, 160);
      ctx.lineTo(120, 40);
      ctx.closePath();
      ctx.fill();
    });
    faces.push(chev);
    // modelled at the original size, scaled per instance
    const geo = new THREE.PlaneGeometry(0.62, 0.78);
    const turn = 0.3;
    const mats: THREE.Matrix4[] = [];
    const postMats: THREE.Matrix4[] = [];
    let last = -100;
    for (let k = 0; k < track.count; k += 4) {
      const cur = track.curvature[k];
      const sk = track.sOf(k);
      if (Math.abs(cur) < 1 / 95 || sk - last < 16) continue;
      last = sk;
      const side = cur > 0 ? -1 : 1; // outside of the bend
      const off = ROAD_HALF + 2.5 + 0.31 * S * Math.cos(turn);
      const x = track.px[k] + track.leftX(k) * off * side;
      const z = track.pz[k] + track.leftZ(k) * off * side;
      const y = terrain.heightAt(x, z) + 1.25 * S;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceYaw(track, k, side * turn));
      // arrow points toward the turn: mirror for right-hand bends
      const scale = new THREE.Vector3(cur > 0 ? -S : S, S, S);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, scale));
      postMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(S, S, S)));
      colliders.addCircle(x, z, 0.25, "pole");
      clear.push({ x, z, r: 5 });
    }
    chev.material.side = THREE.DoubleSide;
    const inst = new THREE.InstancedMesh(geo, chev.material, mats.length);
    mats.forEach((m, k) => inst.setMatrixAt(k, m));
    group.add(inst);
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5);
    postGeo.translate(0, -0.85, -0.03);
    const posts = new THREE.InstancedMesh(postGeo, metalMat, postMats.length);
    postMats.forEach((m, k) => posts.setMatrixAt(k, m));
    group.add(posts);
  }

  const setLang = (lang: Lang) => faces.forEach((f) => f.draw(lang));
  const ready = Promise.all(images).then(() => undefined);

  return {
    group,
    pois,
    gantries,
    clear,
    setLang,
    ready,
    setGlow(signs: number, boards: number) {
      for (const f of faces) f.material.emissiveIntensity = f.kind === "board" ? boards : signs;
    },
  };
}

export function projectTitle(p: DriveProject, lang: Lang) {
  return pick(p, "title", lang);
}
