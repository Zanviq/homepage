import * as THREE from "three";
import { mulberry32 } from "./noise";
import { WORLD_HALF } from "./constants";

const vert = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec2 aOffset;
attribute vec4 aRand;
uniform vec2 uCenter;
uniform float uSize;
uniform float uTime;
uniform sampler2D uHeight;
uniform float uWorldHalf;
uniform vec3 uCar;
uniform float uDensity;
varying float vY;
varying vec3 vColor;
varying float vFlower;
varying vec3 vNormalW;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 p = uCenter + (fract(aOffset - uCenter / uSize) - 0.5) * uSize;
  vec2 tuv = (p + uWorldHalf) / (2.0 * uWorldHalf);
  vec2 hd = texture2D(uHeight, tuv).rg;
  float dens = hd.g * uDensity;
  float dist = length(p - cameraPosition.xz);
  float fade = 1.0 - smoothstep(uSize * 0.26, uSize * 0.47, dist);
  float keep = step(aRand.w, dens) * fade;

  float ang = aRand.x * 6.2831;
  float hgt = (0.28 + aRand.y * 0.5) * (0.6 + dens * 0.6) * keep;
  float wid = (0.06 + aRand.z * 0.06) * keep;
  vec3 local = vec3(position.x * wid, position.y * hgt, 0.0);
  float c = cos(ang), s = sin(ang);
  vec3 rotated = vec3(local.x * c, local.y, local.x * s);

  // wind + bend
  float y2 = position.y * position.y;
  float gust = sin(uTime * 1.7 + p.x * 0.31 + p.y * 0.23) * 0.5 + sin(uTime * 3.1 + p.x * 0.9) * 0.2;
  vec2 bend = vec2(0.35 + gust, 0.15 + gust * 0.4) * 0.22 * hgt * y2;
  // car flattens and pushes blades
  vec2 away = p - uCar.xz;
  float dc = length(away);
  float push = (1.0 - smoothstep(1.2, 2.8, dc)) * step(abs(uCar.y - hd.r), 3.0);
  bend += normalize(away + 1e-4) * push * 0.9 * hgt * position.y;
  rotated.y *= 1.0 - push * 0.6;

  vec3 world = vec3(p.x, hd.r, p.y) + rotated + vec3(bend.x, 0.0, bend.y);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vY = position.y;
  float dry = smoothstep(0.55, 0.9, hash(floor(p / 9.0)));
  vec3 base = mix(vec3(0.05, 0.1, 0.03), vec3(0.11, 0.1, 0.04), dry);
  vec3 tip = mix(vec3(0.3, 0.46, 0.12), vec3(0.55, 0.47, 0.2), dry);
  tip *= 0.8 + aRand.y * 0.4;
  vColor = mix(base, tip, position.y);
  vFlower = step(fract(aRand.x * 97.13), 0.018) * step(0.85, position.y);
  vNormalW = normalize(vec3(-s, 0.9, c));
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying float vY;
varying vec3 vColor;
varying float vFlower;
varying vec3 vNormalW;
void main() {
  vec3 col = vColor;
  if (vFlower > 0.5) col = mix(vec3(0.95, 0.85, 0.3), vec3(0.9, 0.9, 0.95), step(0.5, fract(vColor.r * 173.0)));
  float ndl = abs(dot(normalize(vNormalW), uSunDir));
  float light = 0.35 + 0.65 * ndl;
  vec3 lit = col * (uAmbient + uSunColor * light * 0.55 * (0.5 + 0.5 * vY));
  // translucency toward the sun
  lit += col * uSunColor * 0.25 * vY * max(uSunDir.y, 0.15);
  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Grass {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private size: number;

  constructor(heightTex: THREE.Texture, count: number, size: number) {
    this.size = size;
    // blade: 3 segments + tip, x in [-0.5, 0.5], y in [0, 1]
    const blade = new THREE.BufferGeometry();
    const ys = [0, 0.33, 0.66, 1];
    const pos: number[] = [];
    for (let k = 0; k < 3; k++) {
      const w = 1 - ys[k] * 0.85;
      pos.push(-0.5 * w, ys[k], 0, 0.5 * w, ys[k], 0);
    }
    pos.push(0, 1, 0);
    const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
    const geo = new THREE.InstancedBufferGeometry();
    blade.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.index = new THREE.Uint16BufferAttribute(idx, 1);
    geo.setAttribute("position", blade.attributes.position);
    const off = new Float32Array(count * 2);
    const rnd = new Float32Array(count * 4);
    const rand = mulberry32(42);
    for (let i = 0; i < count; i++) {
      off[i * 2] = rand();
      off[i * 2 + 1] = rand();
      rnd[i * 4] = rand();
      rnd[i * 4 + 1] = rand();
      rnd[i * 4 + 2] = rand();
      rnd[i * 4 + 3] = rand();
    }
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 2));
    geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rnd, 4));
    geo.instanceCount = count;

    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, {
      uCenter: { value: new THREE.Vector2() },
      uSize: { value: size },
      uTime: { value: 0 },
      uHeight: { value: heightTex },
      uWorldHalf: { value: WORLD_HALF },
      uCar: { value: new THREE.Vector3(0, -999, 0) },
      uDensity: { value: 1 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color("#ffffff") },
      uAmbient: { value: new THREE.Color("#445566") },
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      fog: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  update(time: number, camera: THREE.Camera, car: THREE.Vector3) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCenter.value.set(camera.position.x, camera.position.z);
    u.uCar.value.copy(car);
  }

  setLighting(sunDir: THREE.Vector3, sunColor: THREE.Color, ambient: THREE.Color) {
    const u = this.material.uniforms;
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(sunColor);
    u.uAmbient.value.copy(ambient);
  }

  get patchSize() {
    return this.size;
  }
}
