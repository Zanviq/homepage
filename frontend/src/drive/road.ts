import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Colliders } from "./collision";
import { ROAD_HALF } from "./constants";
import type { Track } from "./track";
import type { Terrain } from "./terrain";

const ROAD_LIFT = 0.02;
const MARK_LIFT = 0.032;

export interface RoadTextures {
  diff: THREE.Texture;
  nor: THREE.Texture;
  rough: THREE.Texture;
}

/** Asphalt ribbon following the track, with worn wheel paths. */
export function buildRoadSurface(track: Track, tex: RoadTextures): THREE.Mesh {
  const n = track.count;
  const across = 7; // vertices across (slight camber)
  const pos: number[] = [];
  const uv: number[] = [];
  for (let k = 0; k <= n; k++) {
    const i = k % n;
    const s = (k / n) * track.length;
    const lx = track.leftX(i);
    const lz = track.leftZ(i);
    for (let a = 0; a < across; a++) {
      const f = a / (across - 1); // 0 = left edge, 1 = right edge
      const lat = ROAD_HALF * (1 - 2 * f);
      const camber = 0.05 * (1 - Math.abs(1 - 2 * f));
      pos.push(track.px[i] + lx * lat, track.py[i] + ROAD_LIFT + camber, track.pz[i] + lz * lat);
      uv.push(lat, s);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    for (let a = 0; a < across - 1; a++) {
      const p = k * across + a;
      const q = p + across;
      idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  for (const t of [tex.diff, tex.nor, tex.rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  const mat = new THREE.MeshStandardMaterial({
    map: tex.diff,
    normalMap: tex.nor,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: tex.rough,
    roughness: 1,
    color: new THREE.Color("#8c8c8c"),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  mat.onBeforeCompile = (shader) => {
    // uv is (lateral metres, distance metres); scale to a ~4.5 m texture tile
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRoad;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvRoad = uv;\nvMapUv = uv / 4.5; vNormalMapUv = vMapUv; vRoughnessMapUv = vMapUv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRoad;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float lat = abs(vRoad.x);
        // two worn wheel paths per lane: darker and a little smoother
        float path = exp(-pow((lat - 0.85) / 0.35, 2.0)) + exp(-pow((lat - 2.75) / 0.35, 2.0));
        float grime = 0.5 + 0.5 * sin(vRoad.y * 0.071) * sin(vRoad.y * 0.013 + 1.3);
        diffuseColor.rgb *= 1.0 - path * 0.16 + smoothstep(3.7, 4.3, lat) * 0.08;
        diffuseColor.rgb *= 0.92 + grime * 0.1;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor *= 1.0 - 0.18 * (exp(-pow((abs(vRoad.x) - 0.85) / 0.35, 2.0)) + exp(-pow((abs(vRoad.x) - 2.75) / 0.35, 2.0)));`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Painted lines: white edges, yellow double centre line, start/finish checker. */
export function buildMarkings(track: Track): THREE.Mesh {
  const n = track.count;
  const pos: number[] = [];
  const col: number[] = [];
  const white = new THREE.Color("#e9e8e1");
  const yellow = new THREE.Color("#e6b21f");

  const strip = (offset: number, width: number, color: THREE.Color, dash?: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const s = track.sOf(i);
      if (dash) {
        const m = s % (dash[0] + dash[1]);
        if (m > dash[0]) continue;
      }
      const j = (i + 1) % n;
      const a0 = offset - width / 2;
      const a1 = offset + width / 2;
      const p = (k: number, lat: number) => [
        track.px[k] + track.leftX(k) * lat,
        track.py[k] + MARK_LIFT + 0.05 * (1 - Math.abs(lat) / ROAD_HALF),
        track.pz[k] + track.leftZ(k) * lat,
      ];
      const v = [p(i, a1), p(j, a1), p(i, a0), p(j, a0)];
      pos.push(...v[0], ...v[2], ...v[1], ...v[2], ...v[3], ...v[1]);
      for (let q = 0; q < 6; q++) col.push(color.r, color.g, color.b);
    }
  };
  strip(ROAD_HALF - 0.32, 0.18, white);
  strip(-(ROAD_HALF - 0.32), 0.18, white);
  strip(0.13, 0.13, yellow);
  strip(-0.13, 0.13, yellow);

  // checkered start/finish band at s = 0
  const rows = 3;
  const cols = 14;
  const cell = (ROAD_HALF * 2) / cols;
  const black = new THREE.Color("#1a1a1a");
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = (r + c) % 2 ? black : white;
      const i = track.indexAt(-1 + r * cell);
      const lat0 = -ROAD_HALF + c * cell;
      const lat1 = lat0 + cell;
      const tx = track.tx[i];
      const tz = track.tz[i];
      const base = (lat: number, along: number) => [
        track.px[i] + track.leftX(i) * lat + tx * along,
        track.py[i] + MARK_LIFT + 0.01,
        track.pz[i] + track.leftZ(i) * lat + tz * along,
      ];
      const a = base(lat1, 0);
      const b = base(lat1, cell);
      const cc = base(lat0, 0);
      const d = base(lat0, cell);
      pos.push(...a, ...cc, ...b, ...cc, ...d, ...b);
      for (let q = 0; q < 6; q++) col.push(color.r, color.g, color.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export interface RailSection {
  s0: number;
  s1: number;
  side: 1 | -1; // + = left of travel
}

/** Galvanised W-beam guardrails with posts; registers wall colliders. */
export function buildGuardrails(
  track: Track,
  terrain: Terrain,
  sections: RailSection[],
  colliders: Colliders,
): THREE.Group {
  const group = new THREE.Group();
  const railGeos: THREE.BufferGeometry[] = [];
  const postMatrices: THREE.Matrix4[] = [];
  const profile = [
    [0.0, 0.52],
    [0.07, 0.6],
    [0.0, 0.68],
    [0.07, 0.76],
    [0.0, 0.84],
  ];
  const offsetBase = ROAD_HALF + 1.55;

  for (const sec of sections) {
    const i0 = track.indexAt(sec.s0);
    const count = Math.round((sec.s1 - sec.s0) / 1.5);
    const pts: { x: number; z: number; y: number; nx: number; nz: number }[] = [];
    for (let k = 0; k <= count; k++) {
      const i = (i0 + k) % track.count;
      const nx = track.leftX(i) * sec.side;
      const nz = track.leftZ(i) * sec.side;
      const x = track.px[i] + nx * offsetBase;
      const z = track.pz[i] + nz * offsetBase;
      pts.push({ x, z, y: Math.max(terrain.heightAt(x, z), track.py[i] - 0.3), nx, nz });
    }
    const pos: number[] = [];
    const idx: number[] = [];
    const pw = profile.length;
    pts.forEach((p) => {
      for (const [out, h] of profile) pos.push(p.x + p.nx * out, p.y + h, p.z + p.nz * out);
    });
    for (let k = 0; k < pts.length - 1; k++) {
      for (let a = 0; a < pw - 1; a++) {
        const p0 = k * pw + a;
        const p1 = p0 + pw;
        idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    railGeos.push(g);

    for (let k = 0; k < pts.length; k += 3) {
      const p = pts[k];
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(p.x + p.nx * 0.18, p.y + 0.42, p.z + p.nz * 0.18),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(p.nx, p.nz)),
        new THREE.Vector3(1, 1, 1),
      );
      postMatrices.push(m);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      colliders.addSegment(pts[k].x, pts[k].z, pts[k + 1].x, pts[k + 1].z, "rail");
    }
  }
  if (railGeos.length) {
    const railMat = new THREE.MeshStandardMaterial({
      color: "#aeb4ba",
      metalness: 0.75,
      roughness: 0.38,
      side: THREE.DoubleSide,
    });
    const rails = new THREE.Mesh(mergeGeometries(railGeos), railMat);
    rails.castShadow = true;
    rails.receiveShadow = true;
    group.add(rails);
    const postGeo = new THREE.BoxGeometry(0.12, 0.92, 0.16);
    const posts = new THREE.InstancedMesh(
      postGeo,
      new THREE.MeshStandardMaterial({ color: "#6c7178", metalness: 0.6, roughness: 0.5 }),
      postMatrices.length,
    );
    postMatrices.forEach((m, k) => posts.setMatrixAt(k, m));
    posts.castShadow = true;
    group.add(posts);
  }
  return group;
}

/** Roadside delineator posts every 25 m on both sides. */
export function buildDelineators(track: Track, terrain: Terrain, skip: (s: number) => boolean): THREE.Group {
  const post = new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6);
  post.translate(0, 0.55, 0);
  const refl = new THREE.BoxGeometry(0.1, 0.16, 0.03);
  refl.translate(0, 0.92, 0.07);
  const mats: THREE.Matrix4[] = [];
  for (let s = 0; s < track.length; s += 25) {
    if (skip(s)) continue;
    const i = track.indexAt(s);
    for (const side of [1, -1]) {
      const off = ROAD_HALF + 2.4;
      const x = track.px[i] + track.leftX(i) * off * side;
      const z = track.pz[i] + track.leftZ(i) * off * side;
      const y = terrain.heightAt(x, z);
      const yaw = Math.atan2(-track.tx[i], -track.tz[i]) + (side > 0 ? 0 : 0);
      mats.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y - 0.05, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + Math.PI),
          new THREE.Vector3(1, 1, 1),
        ),
      );
    }
  }
  const g = new THREE.Group();
  const posts = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ color: "#dcdcd6", roughness: 0.85 }), mats.length);
  const reflectors = new THREE.InstancedMesh(
    refl,
    new THREE.MeshStandardMaterial({ color: "#d98a18", emissive: "#ff9a10", emissiveIntensity: 0, roughness: 0.9 }),
    mats.length,
  );
  mats.forEach((m, k) => {
    posts.setMatrixAt(k, m);
    reflectors.setMatrixAt(k, m);
  });
  posts.castShadow = true;
  g.add(posts, reflectors);
  g.userData.reflectors = reflectors;
  return g;
}

export interface StreetLights {
  group: THREE.Group;
  lampMaterial: THREE.MeshStandardMaterial;
  heads: THREE.Vector3[];
}

/** Cobra-head street lights; lamp heads glow at dusk/night. */
export function buildStreetLights(
  track: Track,
  terrain: Terrain,
  ranges: [number, number, number][],
  colliders: Colliders,
): StreetLights {
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.16, 9, 8);
  poleGeo.translate(0, 4.5, 0);
  const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6);
  armGeo.rotateZ(Math.PI / 2);
  armGeo.translate(-1.3, 8.85, 0);
  const headGeo = new THREE.BoxGeometry(0.9, 0.18, 0.38);
  headGeo.translate(-2.55, 8.8, 0);
  const lensGeo = new THREE.PlaneGeometry(0.72, 0.28);
  lensGeo.rotateX(Math.PI / 2);
  lensGeo.translate(-2.55, 8.7, 0);
  const metal = mergeGeometries([poleGeo, armGeo, headGeo]);

  const mats: THREE.Matrix4[] = [];
  const heads: THREE.Vector3[] = [];
  for (const [s0, s1, step] of ranges) {
    let side = 1;
    for (let s = s0; s <= s1; s += step) {
      const i = track.indexAt(s);
      const off = ROAD_HALF + 2.9;
      const lx = track.leftX(i) * side;
      const lz = track.leftZ(i) * side;
      const x = track.px[i] + lx * off;
      const z = track.pz[i] + lz * off;
      const y = terrain.heightAt(x, z);
      // local -x (arm direction) must point toward the road
      const yaw = Math.atan2(-lz, lx);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y - 0.1, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(1, 1, 1),
      );
      mats.push(m);
      heads.push(new THREE.Vector3(-2.55, 8.6, 0).applyMatrix4(m));
      colliders.addCircle(x, z, 0.28, "pole");
      side = -side;
    }
  }
  const group = new THREE.Group();
  const poles = new THREE.InstancedMesh(
    metal,
    new THREE.MeshStandardMaterial({ color: "#8a9096", metalness: 0.7, roughness: 0.42 }),
    mats.length,
  );
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: "#fff2d6",
    emissive: "#ffc778",
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const lenses = new THREE.InstancedMesh(lensGeo, lampMaterial, mats.length);
  mats.forEach((m, k) => {
    poles.setMatrixAt(k, m);
    lenses.setMatrixAt(k, m);
  });
  poles.castShadow = true;
  group.add(poles, lenses);
  return { group, lampMaterial, heads };
}
