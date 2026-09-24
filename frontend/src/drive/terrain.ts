import * as THREE from "three";
import { inLakeBasin, ROAD_HALF, WATER_LEVEL, WORLD_HALF } from "./constants";
import { farHeight, naturalHeight } from "./landform";
import { clamp, lerp, makeSimplex, smoothstep } from "./noise";
import type { Track } from "./track";

/** A flat paved area (parking lot etc.), an oriented rounded rectangle. */
export interface Pad {
  x: number;
  z: number;
  angle: number; // rotation around y
  hx: number; // half extents
  hz: number;
  y: number;
}

const RES = 4; // metres per heightfield cell
const N = (WORLD_HALF * 2) / RES; // cells per side
const V = N + 1; // vertices per side
const ROAD_R = 30; // road influence radius for the distance field

const nPatch = makeSimplex(53);

export function padDistance(p: Pad, x: number, z: number): number {
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  const dx = x - p.x;
  const dz = z - p.z;
  const lx = Math.abs(dx * c - dz * s) - p.hx;
  const lz = Math.abs(dx * s + dz * c) - p.hz;
  const ox = Math.max(lx, 0);
  const oz = Math.max(lz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(lx, lz), 0);
}

export class Terrain {
  readonly heights = new Float32Array(V * V);
  readonly roadDist = new Float32Array(V * V);
  readonly grass = new Float32Array(V * V); // 0..1 grass density
  readonly res = RES;
  readonly size = V;
  heightTexture!: THREE.DataTexture;

  constructor(
    readonly track: Track,
    readonly pads: Pad[],
  ) {
    this.buildRoadField();
    this.buildHeights();
    this.buildGrass();
  }

  private buildRoadField() {
    const t = this.track;
    const roadY = new Float32Array(V * V);
    this.roadDist.fill(1e6);
    const cells = Math.ceil(ROAD_R / RES);
    for (let i = 0; i < t.count; i++) {
      const j = (i + 1) % t.count;
      const ax = t.px[i];
      const az = t.pz[i];
      const bx = t.px[j];
      const bz = t.pz[j];
      const sx = bx - ax;
      const sz = bz - az;
      const sl = sx * sx + sz * sz || 1;
      const gx0 = Math.round((ax + WORLD_HALF) / RES);
      const gz0 = Math.round((az + WORLD_HALF) / RES);
      for (let gz = gz0 - cells; gz <= gz0 + cells; gz++) {
        if (gz < 0 || gz >= V) continue;
        for (let gx = gx0 - cells; gx <= gx0 + cells; gx++) {
          if (gx < 0 || gx >= V) continue;
          const x = gx * RES - WORLD_HALF;
          const z = gz * RES - WORLD_HALF;
          const u = clamp(((x - ax) * sx + (z - az) * sz) / sl, 0, 1);
          const d = Math.hypot(x - (ax + sx * u), z - (az + sz * u));
          const k = gz * V + gx;
          if (d < this.roadDist[k]) {
            this.roadDist[k] = d;
            roadY[k] = lerp(t.py[i], t.py[j], u);
          }
        }
      }
    }
    this.roadYField = roadY;
  }
  private roadYField!: Float32Array;

  private buildHeights() {
    for (let gz = 0; gz < V; gz++) {
      for (let gx = 0; gx < V; gx++) {
        const x = gx * RES - WORLD_HALF;
        const z = gz * RES - WORLD_HALF;
        const k = gz * V + gx;
        let h = naturalHeight(x, z);
        const d = this.roadDist[k];
        if (d < ROAD_R) {
          const w = smoothstep(ROAD_HALF + 2.2, ROAD_HALF + 19, d);
          h = lerp(this.roadYField[k] - 0.14, h, w);
        }
        for (const p of this.pads) {
          const pd = padDistance(p, x, z);
          if (pd < 16) h = lerp(p.y - 0.12, h, smoothstep(0.5, 16, pd));
        }
        this.heights[k] = h;
      }
    }
  }

  private buildGrass() {
    for (let gz = 0; gz < V; gz++) {
      for (let gx = 0; gx < V; gx++) {
        const k = gz * V + gx;
        const x = gx * RES - WORLD_HALF;
        const z = gz * RES - WORLD_HALF;
        const h = this.heights[k];
        const slope = this.slopeAtGrid(gx, gz);
        let g = 1;
        g *= smoothstep(ROAD_HALF + 1.8, ROAD_HALF + 4, this.roadDist[k]);
        g *= 1 - smoothstep(0.32, 0.5, slope);
        if (inLakeBasin(x, z)) g *= smoothstep(WATER_LEVEL + 0.3, WATER_LEVEL + 1.4, h);
        g *= 1 - smoothstep(95, 150, h);
        for (const p of this.pads) g *= smoothstep(0.5, 4, padDistance(p, x, z));
        g *= 0.55 + 0.45 * smoothstep(-0.35, 0.35, nPatch(x / 60, z / 60));
        this.grass[k] = clamp(g, 0, 1);
      }
    }
    // RG half-float texture: height, grass density. Sampled by the grass shader.
    const data = new Uint16Array(V * V * 2);
    for (let k = 0; k < V * V; k++) {
      data[k * 2] = THREE.DataUtils.toHalfFloat(this.heights[k]);
      data[k * 2 + 1] = THREE.DataUtils.toHalfFloat(this.grass[k]);
    }
    const tex = new THREE.DataTexture(data, V, V, THREE.RGFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.heightTexture = tex;
  }

  private slopeAtGrid(gx: number, gz: number): number {
    const x0 = Math.max(gx - 1, 0);
    const x1 = Math.min(gx + 1, V - 1);
    const z0 = Math.max(gz - 1, 0);
    const z1 = Math.min(gz + 1, V - 1);
    const dx = (this.heights[gz * V + x1] - this.heights[gz * V + x0]) / ((x1 - x0) * RES);
    const dz = (this.heights[z1 * V + gx] - this.heights[z0 * V + gx]) / ((z1 - z0) * RES);
    const ny = 1 / Math.sqrt(dx * dx + dz * dz + 1);
    return 1 - ny;
  }

  private bilinear(field: Float32Array, x: number, z: number): number {
    const fx = clamp((x + WORLD_HALF) / RES, 0, N - 0.0001);
    const fz = clamp((z + WORLD_HALF) / RES, 0, N - 0.0001);
    const gx = Math.floor(fx);
    const gz = Math.floor(fz);
    const tx = fx - gx;
    const tz = fz - gz;
    const k = gz * V + gx;
    const a = field[k];
    const b = field[k + 1];
    const c = field[k + V];
    const d = field[k + V + 1];
    // Match the triangle split used by the render mesh (diagonal a-d).
    if (tx >= tz) return a + (b - a) * tx + (d - b) * tz;
    return a + (d - c) * tx + (c - a) * tz;
  }

  heightAt(x: number, z: number): number {
    return this.bilinear(this.heights, x, z);
  }

  roadDistanceAt(x: number, z: number): number {
    return this.bilinear(this.roadDist, x, z);
  }

  normalAt(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const e = 1.5;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }

  slopeAt(x: number, z: number): number {
    const n = this.normalAt(x, z, _n);
    return 1 - n.y;
  }

  /** Terrain meshes split into chunks so off-screen parts are culled. */
  buildMeshes(material: THREE.Material, chunks: number, step: number): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    const per = N / chunks;
    for (let cz = 0; cz < chunks; cz++) {
      for (let cx = 0; cx < chunks; cx++) {
        meshes.push(this.buildChunk(material, cx * per, cz * per, per, step));
      }
    }
    return meshes;
  }

  private buildChunk(material: THREE.Material, gx0: number, gz0: number, per: number, step: number) {
    const cells = per / step;
    const vs = cells + 1;
    const pos = new Float32Array(vs * vs * 3);
    const nor = new Float32Array(vs * vs * 3);
    const splat = new Float32Array(vs * vs * 4);
    const n = new THREE.Vector3();
    for (let j = 0; j < vs; j++) {
      for (let i = 0; i < vs; i++) {
        const gx = gx0 + i * step;
        const gz = gz0 + j * step;
        const k = gz * V + gx;
        const x = gx * RES - WORLD_HALF;
        const z = gz * RES - WORLD_HALF;
        const h = this.heights[k];
        const o = (j * vs + i) * 3;
        pos[o] = x;
        pos[o + 1] = h;
        pos[o + 2] = z;
        this.normalAt(x, z, n);
        nor[o] = n.x;
        nor[o + 1] = n.y;
        nor[o + 2] = n.z;
        const slope = 1 - n.y;
        const d = this.roadDist[k];
        let rock = smoothstep(0.3 + smoothstep(20, 160, h) * -0.08, 0.5, slope) + smoothstep(150, 240, h) * 0.55;
        let gravel = 1 - smoothstep(ROAD_HALF + 0.4, ROAD_HALF + 2.2, d);
        for (const p of this.pads) gravel = Math.max(gravel, 1 - smoothstep(0, 3, padDistance(p, x, z)));
        const shore = inLakeBasin(x, z, 1.5) ? 1 - smoothstep(WATER_LEVEL + 0.4, WATER_LEVEL + 2.2, h) : 0;
        let ground = smoothstep(0.3, 0.65, nPatch(x / 38 + 7, z / 38)) * 0.75 + shore;
        ground += smoothstep(0.12, 0.3, slope) * 0.5;
        rock = clamp(rock, 0, 1);
        gravel = clamp(gravel, 0, 1);
        ground = clamp(ground, 0, 1) * (1 - rock) * (1 - gravel);
        const grass = clamp(1 - rock - gravel - ground, 0, 1);
        const sum = grass + ground + rock + gravel || 1;
        const so = (j * vs + i) * 4;
        splat[so] = grass / sum;
        splat[so + 1] = ground / sum;
        splat[so + 2] = rock / sum;
        splat[so + 3] = gravel / sum;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const a = j * vs + i;
        const b = a + 1;
        const c = a + vs;
        const d = c + 1;
        // split along a-d to match heightAt()
        idx.push(a, c, d, a, d, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("aSplat", new THREE.BufferAttribute(splat, 4));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }
}

const _n = new THREE.Vector3();

/** Low-detail mountains out to the horizon, hidden under the detailed terrain. */
export function buildFarTerrain(): THREE.Mesh {
  const size = 14000;
  const seg = 140;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const rock = new THREE.Color("#6b6863");
  const snow = new THREE.Color("#eef1f5");
  const forest = new THREE.Color("#22331f");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const inner = Math.max(Math.abs(x), Math.abs(z)) < WORLD_HALF - 40;
    let h: number;
    if (inner) h = -80;
    else h = farHeight(x, z);
    pos.setY(i, h);
    const t = smoothstep(260, 520, h);
    c.copy(forest).lerp(rock, smoothstep(120, 300, h)).lerp(snow, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}
