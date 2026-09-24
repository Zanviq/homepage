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
  const F = `${fonts.latin}, ${fonts.korean}, sans-serif`;
  const FK = `${fonts.korean}, ${fonts.latin}, sans-serif`;
  const fam = (lang: Lang) => (lang === "ko" ? FK : F);
  const years = entriesByYear(content);

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

  // ── gantry helper ──
  const gantry = (si: number, w: number, h: number, face: SignFace, clearance = 6.2) => {
    const i = track.indexAt(si);
    const g = new THREE.Group();
    const span = ROAD_HALF + 2.2;
    const y0 = track.py[i];
    const topY = clearance + h;
    for (const side of [1, -1]) {
      const x = track.px[i] + track.leftX(i) * span * side;
      const z = track.pz[i] + track.leftZ(i) * span * side;
      const ground = terrain.heightAt(x, z);
      const p = post(topY - (ground - y0) + 0.4, 0.34);
      p.position.set(x, ground - 0.2, z);
      group.add(p);
      colliders.addCircle(x, z, 0.35, "sign");
    }
    // truss beams across
    const beamLen = span * 2 + 0.4;
    for (const dy of [clearance + 0.25, clearance + h - 0.25]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.22, 0.22), metalMat);
      b.castShadow = true;
      b.position.set(track.px[i], y0 + dy, track.pz[i]);
      b.rotation.y = faceYaw(track, i);
      b.translateZ(-0.45);
      group.add(b);
    }
    const panel = facePanel(face, w, h);
    panel.position.set(track.px[i], y0 + clearance + h / 2, track.pz[i]);
    panel.rotation.y = faceYaw(track, i);
    group.add(panel);
    return { i, g };
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
  const g0 = gantry(GANTRY_S, 12.4, 5.45, startFace);
  pois.push({ id: "start", kind: "start", s: GANTRY_S, x: track.px[g0.i], z: track.pz[g0.i] });

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
    const gy = gantry(ys.s, 8.4, 3.72, face, 6.0);
    pois.push({
      id: `year-${ys.year}`,
      kind: "year",
      s: ys.s,
      x: track.px[gy.i],
      z: track.pz[gy.i],
      year: ys.year,
      entries: ys.entries,
    });

    ys.entries.forEach((e, k) => {
      const side = k % 2 === 0 ? -1 : 1;
      const si = ys.s + 30 + k * 13;
      const i = track.indexAt(si);
      const off = ROAD_HALF + 3.4;
      const x = track.px[i] + track.leftX(i) * off * side;
      const z = track.pz[i] + track.leftZ(i) * off * side;
      const ground = terrain.heightAt(x, z);
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
      const panel = facePanel(plate, 2.9, 1.9, 0.08);
      panel.position.set(x, ground + 2.35 + 0.95, z);
      panel.rotation.y = faceYaw(track, i, side * 0.22);
      group.add(panel);
      for (const dx of [-0.9, 0.9]) {
        const p = post(3.4, 0.09);
        p.position.set(x, ground - 0.2, z);
        p.rotation.y = panel.rotation.y;
        p.translateX(dx);
        p.translateZ(-0.07);
        group.add(p);
      }
      colliders.addCircle(x, z, 1.0, "sign");
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
    const off = ROAD_HALF + 13;
    const x = track.px[i] + track.leftX(i) * off * side;
    const z = track.pz[i] + track.leftZ(i) * off * side;
    const ground = terrain.heightAt(x, z);
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
    const W = 13.6;
    const H = 9.35;
    const lift = 3.4;
    const yaw = faceYaw(track, i, side * 0.42);
    const panel = facePanel(face, W, H, 0.3);
    panel.position.set(x, ground + lift + H / 2, z);
    panel.rotation.y = yaw;
    group.add(panel);
    // legs, catwalk and lamp arms
    for (const dx of [-W * 0.3, W * 0.3]) {
      const leg = post(lift + H * 0.6, 0.45);
      leg.material = darkMetal;
      leg.position.set(x, ground - 0.5, z);
      leg.rotation.y = yaw;
      leg.translateX(dx);
      leg.translateZ(-0.5);
      group.add(leg);
      const lp = leg.position;
      colliders.addCircle(lp.x, lp.z, 0.5, "sign");
    }
    const walk = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 1.0), darkMetal);
    walk.position.set(x, ground + lift - 0.1, z);
    walk.rotation.y = yaw;
    walk.translateZ(0.5);
    walk.castShadow = true;
    group.add(walk);
    for (let q = 0; q < 4; q++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), darkMetal);
      lamp.position.set(x, ground + lift - 0.05, z);
      lamp.rotation.y = yaw;
      lamp.translateX(-W / 2 + W * (q + 0.5) / 4);
      lamp.translateZ(1.2);
      group.add(lamp);
    }
    pois.push({ id: `project-${p.slug}`, kind: "project", s: si, x, z, project: p });
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
    const panel = facePanel(face, 10.8, 6.6, 0.25);
    const ground = terrain.heightAt(bx, bz);
    panel.position.set(bx, ground + 2.2 + 3.3, bz);
    panel.rotation.y = pad.angle + Math.PI;
    group.add(panel);
    for (const dx of [-3.8, 3.8]) {
      const leg = post(5.8, 0.3);
      leg.position.set(bx, ground - 0.2, bz);
      leg.rotation.y = panel.rotation.y;
      leg.translateX(dx);
      leg.translateZ(-0.2);
      group.add(leg);
      colliders.addCircle(leg.position.x, leg.position.z, 0.35, "sign");
    }
    pois.push({ id: "about", kind: "about", s: track.nearest(pad.x, pad.z).s, x: bx, z: bz });

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
    const px = track.px[pi] + track.leftX(pi) * (ROAD_HALF + 3) * side;
    const pz = track.pz[pi] + track.leftZ(pi) * (ROAD_HALF + 3) * side;
    const pg = terrain.heightAt(px, pz);
    const pPanel = facePanel(pFace, 1.4, 1.4, 0.06);
    pPanel.position.set(px, pg + 2.6, pz);
    pPanel.rotation.y = faceYaw(track, pi, 0.2 * side);
    group.add(pPanel);
    const pp = post(2.5, 0.09);
    pp.position.set(px, pg - 0.1, pz);
    group.add(pp);
    colliders.addCircle(px, pz, 0.25, "pole");
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
    const geo = new THREE.PlaneGeometry(0.62, 0.78);
    const mats: THREE.Matrix4[] = [];
    const postMats: THREE.Matrix4[] = [];
    let last = -100;
    for (let k = 0; k < track.count; k += 4) {
      const cur = track.curvature[k];
      const sk = track.sOf(k);
      if (Math.abs(cur) < 1 / 95 || sk - last < 16) continue;
      last = sk;
      const side = cur > 0 ? -1 : 1; // outside of the bend
      const off = ROAD_HALF + 2.8;
      const x = track.px[k] + track.leftX(k) * off * side;
      const z = track.pz[k] + track.leftZ(k) * off * side;
      const y = terrain.heightAt(x, z) + 1.25;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceYaw(track, k, side * 0.3));
      // arrow points toward the turn: mirror for right-hand bends
      const scale = new THREE.Vector3(cur > 0 ? -1 : 1, 1, 1);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, scale));
      postMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
      colliders.addCircle(x, z, 0.2, "pole");
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
