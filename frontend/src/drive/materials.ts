import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { LAKE, WATER_LEVEL } from "./constants";

export interface TerrainTextures {
  grass: THREE.Texture;
  grassN: THREE.Texture;
  ground: THREE.Texture;
  groundN: THREE.Texture;
  rock: THREE.Texture;
  rockN: THREE.Texture;
  gravel: THREE.Texture;
}

/** Splat-mapped ground: grass / forest floor / rock / gravel with detail normals. */
export function terrainMaterial(t: TerrainTextures, high: boolean): THREE.MeshStandardMaterial {
  for (const tex of Object.values(t)) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = high ? 8 : 2;
  }
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tGrass: { value: t.grass },
      tGrassN: { value: t.grassN },
      tGround: { value: t.ground },
      tGroundN: { value: t.groundN },
      tRock: { value: t.rock },
      tRockN: { value: t.rockN },
      tGravel: { value: t.gravel },
    });
    shader.defines = { ...(shader.defines ?? {}), ...(high ? { TERRAIN_HQ: "" } : {}) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec4 aSplat;
        varying vec4 vSplat;
        varying vec3 vWPos;
        varying vec3 vWNormal;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vWNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vSplat = aSplat;
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D tGrass, tGrassN, tGround, tGroundN, tRock, tRockN, tGravel;
        varying vec4 vSplat;
        varying vec3 vWPos;
        varying vec3 vWNormal;
        vec3 rockTri(vec3 p, vec3 n) {
          #ifdef TERRAIN_HQ
            vec3 bw = pow(abs(n), vec3(4.0));
            bw /= (bw.x + bw.y + bw.z);
            return texture2D(tRock, p.zy / 9.0).rgb * bw.x + texture2D(tRock, p.xz / 9.0).rgb * bw.y + texture2D(tRock, p.xy / 9.0).rgb * bw.z;
          #else
            return texture2D(tRock, p.xz / 9.0).rgb;
          #endif
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 wn = normalize(vWNormal);
        vec2 wuv = vWPos.xz;
        float macro = texture2D(tGround, wuv / 71.0).g;
        float macro2 = texture2D(tGround, wuv / 43.0).r;
        vec3 cGrass = mix(texture2D(tGrass, wuv / 7.0).rgb, texture2D(tGrass, wuv / 26.0 + 0.37).rgb, 0.4);
        cGrass *= 0.85 + macro2 * 0.35;
        vec3 cGround = texture2D(tGround, wuv / 3.6).rgb * vec3(1.02, 0.95, 0.86);
        vec3 cRock = rockTri(vWPos, wn) * vec3(0.95, 0.93, 0.9);
        vec3 cGravel = texture2D(tGravel, wuv / 2.6).rgb * 0.9;
        vec4 w = vSplat;
        // sharpen blends with the texture luminance (height-blend style)
        float gl = dot(cGround, vec3(0.33));
        w.y *= 0.6 + gl * 0.9;
        w.z *= 0.7 + dot(cRock, vec3(0.33)) * 0.8;
        w /= max(w.x + w.y + w.z + w.w, 1e-3);
        vec3 col = cGrass * w.x + cGround * w.y + cRock * w.z + cGravel * w.w;
        col *= 0.78 + macro * 0.45;
        float snow = smoothstep(185.0, 240.0, vWPos.y + macro * 40.0) * smoothstep(0.45, 0.8, wn.y);
        col = mix(col, vec3(0.9, 0.92, 0.96), snow);
        col *= mix(0.55, 1.0, smoothstep(-0.3, 0.8, vWPos.y));
        diffuseColor.rgb *= col;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        #ifdef TERRAIN_HQ
        {
          vec3 ng = texture2D(tGrassN, wuv / 7.0).xyz * 2.0 - 1.0;
          vec3 nd = texture2D(tGroundN, wuv / 3.6).xyz * 2.0 - 1.0;
          vec3 nr = texture2D(tRockN, wuv / 9.0).xyz * 2.0 - 1.0;
          vec3 d = ng * vSplat.x + nd * (vSplat.y + vSplat.w) + nr * vSplat.z;
          vec3 nW = normalize(normalize(vWNormal) + vec3(d.x, 0.0, d.y) * 0.55);
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }
        #endif`,
      );
  };
  return mat;
}

export interface Lake {
  mesh: THREE.Mesh;
  update(time: number): void;
  setSun(dir: THREE.Vector3, color: THREE.Color, fog: boolean): void;
}

/** Lake surface. High quality uses a planar-reflection water shader. */
export function buildLake(normals: THREE.Texture, high: boolean): Lake {
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  const geo = new THREE.CircleGeometry(LAKE.r * 1.45, 64);
  if (high) {
    const water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x0d2a2f,
      distortionScale: 2.2,
      fog: true,
      alpha: 0.96,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
    const u = (water.material as THREE.ShaderMaterial).uniforms;
    u.size.value = 3.2;
    return {
      mesh: water,
      update(time) {
        u.time.value = time * 0.35;
      },
      setSun(dir, color) {
        u.sunDirection.value.copy(dir);
        u.sunColor.value.copy(color);
      },
    };
  }
  const mat = new THREE.MeshStandardMaterial({
    color: "#123a40",
    roughness: 0.06,
    metalness: 0.1,
    normalMap: normals,
    normalScale: new THREE.Vector2(0.25, 0.25),
    transparent: true,
    opacity: 0.92,
  });
  normals.repeat.set(12, 12);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
  return {
    mesh,
    update(time) {
      normals.offset.set(time * 0.01, time * 0.006);
    },
    setSun() {},
  };
}
