import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Colliders } from "./collision";
import { clamp, fbm, makeSimplex, mulberry32, smoothstep } from "./noise";
import { padDistance, type Pad, type Terrain } from "./terrain";
import { inLakeBasin, ROAD_HALF, WATER_LEVEL, WORLD_HALF } from "./constants";

const nForest = makeSimplex(71);
const nMix = makeSimplex(83);

// ── textures ──────────────────────────────────────────────────────────────

/** Fir branch seen from above, trunk at the left edge, tip at the right. */
function firTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(5);
  // opaque corner for trunk UVs (so alpha-tested shadows keep the trunk)
  ctx.fillStyle = "#3a2e22";
  ctx.fillRect(0, 0, 8, 8);
  const stem = (x0: number, y0: number, len: number, ang: number, width: number, depth: number) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    ctx.strokeStyle = "#3b3322";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // needles along the stem
    const count = Math.floor(len / 2.2);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      const nl = (10 + rand() * 9) * (1 - t * 0.45) * (depth ? 0.8 : 1);
      for (const s of [-1, 1]) {
        const a = ang + s * (0.95 + rand() * 0.4);
        const shade = 0.7 + rand() * 0.45 + t * 0.2;
        const g = Math.floor(76 * shade);
        ctx.strokeStyle = `rgb(${Math.floor(34 * shade)},${g},${Math.floor(40 * shade)})`;
        ctx.lineWidth = 1.6 + rand();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl);
        ctx.stroke();
      }
    }
    if (depth < 1) {
      for (let k = 0; k < 7; k++) {
        const t = 0.15 + k * 0.11 + rand() * 0.04;
        const s = k % 2 ? 1 : -1;
        stem(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, len * (0.42 - t * 0.28), ang + s * (0.62 + rand() * 0.25), width * 0.5, depth + 1);
      }
    }
  };
  stem(4, h / 2, w - 24, 0, 5, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Round cluster of leaves. */
function leafTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(9);
  ctx.fillStyle = "#4a3b2a";
  ctx.fillRect(0, 0, 6, 6);
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * s * 0.42;
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r;
    const shade = 0.6 + rand() * 0.55 + (1 - r / (s * 0.42)) * 0.1 - (y / s) * 0.15;
    ctx.fillStyle = `rgb(${Math.floor(78 * shade)},${Math.floor(112 * shade)},${Math.floor(46 * shade)})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 + rand() * 6, 4.5 + rand() * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ── geometry (normalised: tree height = 1) ────────────────────────────────

function card(
  out: { pos: number[]; nor: number[]; uv: number[]; idx: number[] },
  corners: THREE.Vector3[],
  uvs: number[][],
  normals: THREE.Vector3[],
) {
  const base = out.pos.length / 3;
  corners.forEach((p, k) => {
    out.pos.push(p.x, p.y, p.z);
    out.nor.push(normals[k].x, normals[k].y, normals[k].z);
    out.uv.push(uvs[k][0], uvs[k][1]);
  });
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function trunk(height: number, r0: number, r1: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, height, 7, 1, true);
  g.translate(0, height / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.004, 0.996);
  return g;
}

function toGeo(o: { pos: number[]; nor: number[]; uv: number[]; idx: number[] }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(o.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(o.uv, 2));
  g.setIndex(o.idx);
  return g;
}

function conifer(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const o = { pos: [] as number[], nor: [] as number[], uv: [] as number[], idx: [] as number[] };
  const tiers = 12;
  const up = new THREE.Vector3(0, 1, 0);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const y = 0.14 + f * 0.8 + (rand() - 0.5) * 0.03;
    const radius = 0.3 * Math.pow(1 - f, 0.9) + 0.035;
    const k = Math.max(6, Math.round(12 - f * 5));
    const off = rand() * Math.PI * 2;
    for (let j = 0; j < k; j++) {
      const a = off + (j / k) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const droop = 0.18 + rand() * 0.12 + f * 0.1;
      const len = radius * (0.85 + rand() * 0.3);
      const wid = len * 0.4 + 0.025;
      const tip = dir.clone().multiplyScalar(len).add(new THREE.Vector3(0, y - droop * len, 0));
      const root = new THREE.Vector3(0, y + 0.01, 0).addScaledVector(dir, 0.01);
      // tilt the card a little so tiers read as volume from the side
      const roll = (rand() - 0.5) * 0.9;
      const s = side.clone().multiplyScalar(wid * Math.cos(roll)).add(new THREE.Vector3(0, wid * Math.sin(roll), 0));
      const corners = [root.clone().sub(s), tip.clone().sub(s), tip.clone().add(s), root.clone().add(s)];
      const nOut = dir.clone().multiplyScalar(0.8).addScaledVector(up, 0.6).normalize();
      const nIn = dir.clone().multiplyScalar(0.2).addScaledVector(up, 0.9).normalize();
      card(o, corners, [[0, 0], [1, 0], [1, 1], [0, 1]], [nIn, nOut, nOut, nIn]);
    }
  }
  // crown spike
  for (const a of [0, Math.PI / 2]) {
    const s = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.05);
    const b = new THREE.Vector3(0, 0.86, 0);
    const t = new THREE.Vector3(0, 1.0, 0);
    card(o, [b.clone().sub(s), t.clone().sub(s), t.clone().add(s), b.clone().add(s)], [[0, 0], [1, 0], [1, 1], [0, 1]], [up, up, up, up]);
  }
  const foliage = toGeo(o);
  return mergeGeometries([trunk(0.92, 0.024, 0.006), foliage], true);
}

function broadleaf(seed: number, bush = false): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const o = { pos: [] as number[], nor: [] as number[], uv: [] as number[], idx: [] as number[] };
  const cy = bush ? 0.45 : 0.66;
  // a crown is a few overlapping lobes, so the silhouette is lumpy, not a ball
  const lobes: { c: THREE.Vector3; r: number }[] = [];
  const nl = bush ? 3 : 5;
  for (let l = 0; l < nl; l++) {
    const a = (l / nl) * Math.PI * 2 + rand() * 0.8;
    const d = l === 0 ? 0 : (bush ? 0.22 : 0.15) + rand() * 0.08;
    lobes.push({
      c: new THREE.Vector3(Math.cos(a) * d, cy + (l === 0 ? 0.06 : (rand() - 0.4) * 0.14), Math.sin(a) * d),
      r: (bush ? 0.3 : 0.17) + rand() * (bush ? 0.1 : 0.06),
    });
  }
  const crown = new THREE.Vector3(0, cy, 0);
  const per = bush ? 7 : 16;
  for (const lobe of lobes) {
    for (let k = 0; k < per; k++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const dir = new THREE.Vector3(Math.cos(a) * rr, u * 0.85 + 0.1, Math.sin(a) * rr).normalize();
      const c = lobe.c.clone().addScaledVector(dir, lobe.r * (0.55 + rand() * 0.35));
      const size = (bush ? 0.3 : 0.16) * (0.8 + rand() * 0.45);
      // shade from the crown centre so the whole tree reads as one volume
      const nrm = c.clone().sub(crown).normalize().multiplyScalar(0.7).add(dir.clone().multiplyScalar(0.3)).normalize();
      const t1 = new THREE.Vector3(0, 1, 0).cross(dir);
      if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = dir.clone().cross(t1).normalize();
      const spin = rand() * Math.PI;
      const ax = t1.clone().multiplyScalar(Math.cos(spin)).addScaledVector(t2, Math.sin(spin)).multiplyScalar(size);
      const ay = t2.clone().multiplyScalar(Math.cos(spin)).addScaledVector(t1, -Math.sin(spin)).multiplyScalar(size);
      const corners = [c.clone().sub(ax).sub(ay), c.clone().add(ax).sub(ay), c.clone().add(ax).add(ay), c.clone().sub(ax).add(ay)];
      card(o, corners, [[0, 0], [1, 0], [1, 1], [0, 1]], [nrm, nrm, nrm, nrm]);
    }
  }
  const foliage = toGeo(o);
  if (bush) return mergeGeometries([trunk(0.2, 0.03, 0.02), foliage], true);
  const parts = [trunk(0.58, 0.028, 0.014)];
  for (const lobe of lobes.slice(1)) {
    // a limb from the trunk toward each lobe
    const from = new THREE.Vector3(0, 0.4 + rand() * 0.1, 0);
    const to = lobe.c.clone();
    const len = from.distanceTo(to);
    const g = trunk(len, 0.012, 0.005);
    g.translate(0, 0, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    g.applyQuaternion(q);
    g.translate(from.x, from.y, from.z);
    parts.push(g);
  }
  return mergeGeometries([mergeGeometries(parts), foliage], true);
}

// ── materials ─────────────────────────────────────────────────────────────

export interface WindUniforms {
  uTime: { value: number };
}

function foliageMaterial(map: THREE.Texture, wind: WindUniforms, strength: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 org = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 org = vec3(0.0);
        #endif
        float hh = max(position.y, 0.0);
        float ph = org.x * 0.045 + org.z * 0.037;
        float sway = sin(uTime * 1.25 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25;
        transformed.x += sway * ${strength.toFixed(3)} * hh * hh;
        transformed.z += cos(uTime * 1.05 + ph) * ${(strength * 0.6).toFixed(3)} * hh * hh;`,
      );
    // soft translucency: foliage lit from behind still glows a little
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= 1.25;`,
    );
  };
  return m;
}

// ── scatter + level of detail ─────────────────────────────────────────────

export interface ScatterContext {
  terrain: Terrain;
  pads: Pad[];
  keepClear: { x: number; z: number; r: number }[];
  colliders: Colliders;
  density: number; // 1 = high quality, ~0.55 = low
  renderer: THREE.WebGLRenderer;
}

export interface Vegetation {
  group: THREE.Group;
  wind: WindUniforms;
  treeCount: number;
  /** Re-pick which trees get full geometry (call every frame; cheap unless the camera moved). */
  update(camera: THREE.Camera): void;
}

/** Full-detail trees are drawn within this radius; beyond it, impostors. */
const NEAR_R = 170;
const REPICK = 18;

interface Kind {
  geo: THREE.BufferGeometry;
  mats: THREE.Material[];
  depth: THREE.Material;
  shadow: boolean;
  impostor: boolean;
  width: number; // crown width relative to height (for the impostor quad)
}

/** Render a normalised tree (height 1) from the side into a texture. */
function bakeImpostor(renderer: THREE.WebGLRenderer, kind: Kind): THREE.Texture {
  const rt = new THREE.WebGLRenderTarget(128, 256, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const scene = new THREE.Scene();
  const basic = kind.mats.map((m) => {
    const s = m as THREE.MeshStandardMaterial;
    return new THREE.MeshBasicMaterial({
      map: s.map ?? null,
      color: s.map ? new THREE.Color(1, 1, 1) : s.color,
      alphaTest: s.alphaTest || 0,
      side: THREE.DoubleSide,
    });
  });
  const mesh = new THREE.Mesh(kind.geo, basic);
  scene.add(mesh);
  const hw = kind.width / 2;
  const cam = new THREE.OrthographicCamera(-hw, hw, 1.02, -0.02, -5, 5);
  cam.position.set(0, 0, 2);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  // a second, rotated pass so the silhouette isn't a single thin slice
  mesh.rotation.y = Math.PI / 2;
  renderer.autoClear = false;
  renderer.render(scene, cam);
  renderer.autoClear = true;
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  basic.forEach((m) => m.dispose());
  return rt.texture;
}

function impostorMaterial(tex: THREE.Texture, uCam: { value: THREE.Vector3 }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCam = uCam;
    shader.uniforms.uNear = { value: NEAR_R };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uCam;\nuniform float uNear;")
      .replace(
        "#include <project_vertex>",
        `vec3 org = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        vec3 toCam = cameraPosition - org;
        toCam.y = 0.0;
        float dist = length(toCam);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam + vec3(1e-4, 0.0, 0.0)));
        vec3 wp = org + right * position.x * sx + vec3(0.0, position.y * sy, 0.0);
        // full-detail trees take over inside the near radius
        if (distance(org.xz, uCam.xz) < uNear) wp = org;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vNormal = normalize((viewMatrix * vec4(normalize(toCam / max(dist, 1.0)) * 0.55 + vec3(0.0, 0.8, 0.0), 0.0)).xyz);`,
      );
  };
  return m;
}

export function buildVegetation(ctx: ScatterContext, rockTex: { diff: THREE.Texture; nor: THREE.Texture }): Vegetation {
  const { terrain, pads, keepClear, colliders, density, renderer } = ctx;
  const wind: WindUniforms = { uTime: { value: 0 } };
  const fir = firTexture();
  const leaf = leafTexture();
  const firMat = foliageMaterial(fir, wind, 0.012);
  const leafMat = foliageMaterial(leaf, wind, 0.02);
  const barkDark = new THREE.MeshStandardMaterial({ color: "#3d3127", roughness: 0.95 });
  const barkLight = new THREE.MeshStandardMaterial({ color: "#6e655a", roughness: 0.9 });
  const depthFir = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: fir, alphaTest: 0.45 });
  const depthLeaf = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leaf, alphaTest: 0.45 });

  const kinds: Kind[] = [
    { geo: conifer(1), mats: [barkDark, firMat], depth: depthFir, shadow: true, impostor: true, width: 0.72 },
    { geo: conifer(2), mats: [barkDark, firMat], depth: depthFir, shadow: true, impostor: true, width: 0.72 },
    { geo: broadleaf(3), mats: [barkLight, leafMat], depth: depthLeaf, shadow: true, impostor: true, width: 0.8 },
    { geo: broadleaf(4), mats: [barkLight, leafMat], depth: depthLeaf, shadow: true, impostor: true, width: 0.8 },
    { geo: broadleaf(5, true), mats: [barkLight, leafMat], depth: depthLeaf, shadow: false, impostor: false, width: 1.1 },
  ];
  type Inst = { x: number; z: number; m: THREE.Matrix4; c: THREE.Color };
  const lists: Inst[][] = kinds.map(() => []);

  const rand = mulberry32(1234);
  const cell = 8.5;
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let treeCount = 0;
  const clearOk = (x: number, z: number) => {
    for (const k of keepClear) if ((x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r) return false;
    for (const p of pads) if (padDistance(p, x, z) < 7) return false;
    return true;
  };

  for (let gz = -WORLD_HALF + cell; gz < WORLD_HALF - cell; gz += cell) {
    for (let gx = -WORLD_HALF + cell; gx < WORLD_HALF - cell; gx += cell) {
      const x = gx + (rand() - 0.5) * cell * 0.9;
      const z = gz + (rand() - 0.5) * cell * 0.9;
      const r = Math.hypot(x, z);
      if (r > 1400) continue;
      const h = terrain.heightAt(x, z);
      const d = terrain.roadDistanceAt(x, z);
      const slope = terrain.slopeAt(x, z);
      const forest = smoothstep(0.02, 0.42, fbm(nForest, x / 240, z / 240, 3));
      const foothill = smoothstep(540, 700, r) * (1 - smoothstep(130, 210, h));
      let dens = Math.max(forest * 0.55, foothill * 0.5) + 0.03;
      dens *= smoothstep(ROAD_HALF + 6, ROAD_HALF + 26, d) * 0.85 + (d > ROAD_HALF + 6 ? 0.15 : 0);
      if ((h < WATER_LEVEL + 0.9 && inLakeBasin(x, z)) || slope > 0.45) continue;
      const roll = rand();
      const bushRoll = rand();
      if (!clearOk(x, z)) continue;
      if (bushRoll < 0.09 * density && d > ROAD_HALF + 4 && d < 70) {
        const s = 1.2 + rand() * 1.6;
        const bx = x + 2;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(bx, terrain.heightAt(bx, z) - 0.1, z),
          q.setFromAxisAngle(yAxis, rand() * 6.28),
          new THREE.Vector3(s * (0.9 + rand() * 0.3), s, s * (0.9 + rand() * 0.3)),
        );
        lists[4].push({ x: bx, z, m, c: new THREE.Color().setHSL(0.23 + rand() * 0.06, 0.35, 0.36 + rand() * 0.12).multiplyScalar(2) });
      }
      if (roll > dens * density) continue;
      const conProb = 0.5 + 0.4 * smoothstep(8, 110, h) - 0.3 * smoothstep(0.1, 0.5, nMix(x / 150, z / 150));
      const isCon = rand() < conProb;
      const kind = isCon ? (rand() < 0.5 ? 0 : 1) : rand() < 0.5 ? 2 : 3;
      const height = isCon ? 11 + rand() * 12 : 8 + rand() * 6.5;
      const w = height * (0.85 + rand() * 0.3);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, h - 0.25, z),
        q.setFromAxisAngle(yAxis, rand() * 6.28),
        new THREE.Vector3(w, height, w),
      );
      const color = isCon
        ? new THREE.Color().setHSL(0.3 + rand() * 0.05, 0.28 + rand() * 0.1, 0.34 + rand() * 0.1)
        : new THREE.Color().setHSL(0.2 + rand() * 0.09, 0.4, 0.42 + rand() * 0.14);
      lists[kind].push({ x, z, m, c: color.multiplyScalar(2.2) });
      if (r < 900) colliders.addCircle(x, z, isCon ? height * 0.024 + 0.1 : 0.32, "tree");
      treeCount++;
    }
  }

  const group = new THREE.Group();
  const uCam = { value: new THREE.Vector3(1e9, 0, 1e9) };
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);

  // near: full geometry, refilled as the camera moves
  const near = kinds.map((kind, ki) => {
    const cap = Math.max(1, Math.min(lists[ki].length, 4000));
    const mesh = new THREE.InstancedMesh(kind.geo, kind.mats, cap);
    mesh.count = 0;
    mesh.castShadow = kind.shadow;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = kind.depth;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return mesh;
  });
  // far: camera-facing impostors for every tree (collapsed inside NEAR_R by the shader)
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const ident = new THREE.Quaternion();
  kinds.forEach((kind, ki) => {
    if (!kind.impostor || !lists[ki].length) return;
    const tex = bakeImpostor(renderer, kind);
    const mesh = new THREE.InstancedMesh(quad, impostorMaterial(tex, uCam), lists[ki].length);
    lists[ki].forEach((it, k) => {
      it.m.decompose(pos, rot, s);
      mesh.setMatrixAt(k, new THREE.Matrix4().compose(pos, ident, new THREE.Vector3(s.x * kind.width, s.y, 1)));
      mesh.setColorAt(k, it.c);
    });
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  const last = new THREE.Vector3(1e9, 0, 1e9);
  const r2 = NEAR_R * NEAR_R;
  const bushR2 = 110 * 110;
  const update = (camera: THREE.Camera) => {
    const p = camera.position;
    if ((p.x - last.x) ** 2 + (p.z - last.z) ** 2 < REPICK * REPICK) return;
    last.copy(p);
    uCam.value.set(p.x, 0, p.z);
    kinds.forEach((kind, ki) => {
      const mesh = near[ki];
      const lim = kind.impostor ? r2 : bushR2;
      const cap = mesh.instanceMatrix.count;
      let n = 0;
      for (const it of lists[ki]) {
        if ((it.x - p.x) ** 2 + (it.z - p.z) ** 2 > lim) continue;
        if (n >= cap) break;
        mesh.setMatrixAt(n, it.m);
        mesh.setColorAt(n, it.c);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  };

  group.add(buildRocks(ctx, rockTex));
  return { group, wind, treeCount, update };
}

function rockGeometry(seed: number): THREE.BufferGeometry {
  const noise = makeSimplex(seed);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(noise, v.x * 1.1 + v.y * 0.7, v.z * 1.1 - v.y * 0.5, 4);
    v.multiplyScalar(1 + n * 0.32);
    v.y = v.y < 0 ? v.y * 0.35 : v.y * 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // box-projected UVs
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny > nx && ny > nz) uv.setXY(i, x * 0.5, z * 0.5);
    else if (nx > nz) uv.setXY(i, z * 0.5, y * 0.5);
    else uv.setXY(i, x * 0.5, y * 0.5);
  }
  return g;
}

function buildRocks(ctx: ScatterContext, tex: { diff: THREE.Texture; nor: THREE.Texture }): THREE.Group {
  const { terrain, colliders, keepClear, pads } = ctx;
  for (const t of [tex.diff, tex.nor]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: tex.diff,
    normalMap: tex.nor,
    color: "#b9b4ac",
    roughness: 0.92,
  });
  const geos = [rockGeometry(101), rockGeometry(202), rockGeometry(303)];
  const lists: THREE.Matrix4[][] = [[], [], []];
  const rand = mulberry32(777);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let placed = 0;
  for (let tries = 0; tries < 9000 && placed < 520; tries++) {
    const x = (rand() * 2 - 1) * 950;
    const z = (rand() * 2 - 1) * 950;
    const r = Math.hypot(x, z);
    const h = terrain.heightAt(x, z);
    const d = terrain.roadDistanceAt(x, z);
    const slope = terrain.slopeAt(x, z);
    if (d < ROAD_HALF + 5 || h < WATER_LEVEL - 1.5) continue;
    if (keepClear.some((k) => (x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r)) continue;
    if (pads.some((p) => padDistance(p, x, z) < 4)) continue;
    const want = 0.04 + smoothstep(0.2, 0.45, slope) * 0.6 + smoothstep(600, 800, r) * 0.4 + (h < 1.5 && h > -1 ? 0.3 : 0);
    if (rand() > want) continue;
    const size = (0.5 + Math.pow(rand(), 2.5) * 4.5) * (1 + smoothstep(600, 850, r) * 1.5);
    e.set(rand() * 0.4, rand() * 6.28, rand() * 0.4);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h - size * 0.25, z),
      q.setFromEuler(e),
      new THREE.Vector3(size * (0.8 + rand() * 0.5), size * (0.6 + rand() * 0.5), size * (0.8 + rand() * 0.5)),
    );
    lists[placed % 3].push(m);
    if (size > 0.8 && r < 900) colliders.addCircle(x, z, size * 0.75, "rock");
    placed++;
  }
  const g = new THREE.Group();
  lists.forEach((list, k) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geos[k], mat, list.length);
    list.forEach((m, j) => mesh.setMatrixAt(j, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    g.add(mesh);
  });
  return g;
}
