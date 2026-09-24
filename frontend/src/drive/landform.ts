// The natural shape of the land, before roads and pads are cut into it.

import { LAKE } from "./constants";
import { fbm, lerp, makeSimplex, ridged, smoothstep } from "./noise";

const nHills = makeSimplex(11);
const nDetail = makeSimplex(23);
const nRidge = makeSimplex(37);
const nMtn = makeSimplex(41);
const nWarp = makeSimplex(59);

/** Rolling valley floor: always well above the lake's water level. */
function valley(x: number, z: number): number {
  let h = 9 + fbm(nHills, x / 380, z / 380, 4) * 11 + fbm(nDetail, x / 90, z / 90, 3) * 1.8;
  // a wooded knoll inside the loop and a hill by the hairpin
  h += 24 * Math.exp(-((x + 110) ** 2 + (z - 70) ** 2) / (2 * 105 * 105));
  h += 16 * Math.exp(-((x - 150) ** 2 + (z + 300) ** 2) / (2 * 85 * 85));
  return h;
}

/** Mountain range ringing the valley: broad massifs, not spikes. */
function mountains(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const m = smoothstep(560, 940, r);
  if (m <= 0) return 0;
  const wx = x + fbm(nWarp, x / 600, z / 600, 3) * 220;
  const wz = z + fbm(nWarp, z / 600 + 7, x / 600 - 3, 3) * 220;
  const crest = ridged(nRidge, wx / 720 + 3.1, wz / 720 - 1.7, 4);
  const mass = 0.55 + 0.45 * fbm(nMtn, x / 900, z / 900, 2);
  return m * m * (30 + Math.pow(crest, 1.35) * 330 * mass) + m * fbm(nMtn, x / 140, z / 140, 3) * 14;
}

export function naturalHeight(x: number, z: number): number {
  let h = valley(x, z) + mountains(x, z);
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  const bowl = 1 - smoothstep(LAKE.r * 0.55, LAKE.r * 1.3, ld);
  if (bowl > 0) {
    const floor = -7.5 + 6 * (ld / LAKE.r) ** 2;
    h = lerp(h, floor, bowl * bowl * (3 - 2 * bowl));
  }
  return h;
}

/** Far-field mountains for the horizon mesh (same family of shapes, larger). */
export function farHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const wx = x + fbm(nWarp, x / 1400, z / 1400, 2) * 500;
  const wz = z + fbm(nWarp, z / 1400 + 7, x / 1400 - 3, 2) * 500;
  const crest = ridged(nRidge, wx / 1500 + 11, wz / 1500 - 4, 4);
  let h = 80 + Math.pow(crest, 1.3) * 820 * smoothstep(900, 2600, r) + mountains(x, z) * 0.6;
  h *= 1 - smoothstep(5200, 6800, r) * 0.7;
  return h;
}
