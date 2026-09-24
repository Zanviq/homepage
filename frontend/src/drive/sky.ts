import * as THREE from "three";
import type { TimeOfDay } from "./types";

export interface SkyPreset {
  sunElevation: number; // degrees
  sunAzimuth: number; // degrees, 0 = -z (north), clockwise
  zenith: string;
  horizon: string;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  glow: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  envIntensity: number;
  exposure: number;
  cloudLit: string;
  cloudShade: string;
  cloudCover: number;
  stars: number;
  headlights: boolean;
  lampGlow: number; // emissive strength for street lamps / billboards
}

export const PRESETS: Record<TimeOfDay, SkyPreset> = {
  day: {
    sunElevation: 46,
    sunAzimuth: 150,
    zenith: "#2f68c0",
    horizon: "#b7cde3",
    fog: "#b3c8dc",
    fogDensity: 0.00032,
    sunColor: "#fff3e0",
    sunIntensity: 3.1,
    glow: "#fff6de",
    hemiSky: "#c3dcff",
    hemiGround: "#5a6440",
    hemiIntensity: 1.0,
    envIntensity: 1.0,
    exposure: 0.85,
    cloudLit: "#ffffff",
    cloudShade: "#9aa7b8",
    cloudCover: 0.46,
    stars: 0,
    headlights: false,
    lampGlow: 0.05,
  },
  dusk: {
    sunElevation: 6.5,
    sunAzimuth: 238,
    zenith: "#35507e",
    horizon: "#e7ad84",
    fog: "#c99e86",
    fogDensity: 0.00042,
    sunColor: "#ffb26b",
    sunIntensity: 3.4,
    glow: "#ffb46a",
    hemiSky: "#8ea6d6",
    hemiGround: "#5a4a3a",
    hemiIntensity: 0.75,
    envIntensity: 0.9,
    exposure: 0.95,
    cloudLit: "#ffc596",
    cloudShade: "#6a6782",
    cloudCover: 0.5,
    stars: 0,
    headlights: true,
    lampGlow: 0.55,
  },
  night: {
    sunElevation: 38,
    sunAzimuth: 120,
    zenith: "#03060f",
    horizon: "#151f33",
    fog: "#0e1626",
    fogDensity: 0.00055,
    sunColor: "#8fa6ff",
    sunIntensity: 0.32,
    glow: "#6d7fb8",
    hemiSky: "#2b3a66",
    hemiGround: "#0d0f14",
    hemiIntensity: 0.28,
    envIntensity: 0.35,
    exposure: 1.15,
    cloudLit: "#3c4a6e",
    cloudShade: "#0a0f1c",
    cloudCover: 0.38,
    stars: 1,
    headlights: true,
    lampGlow: 1.4,
  },
};

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const frag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uFog;
uniform vec3 uSunDir;
uniform vec3 uGlow;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uCover;
uniform float uStars;
uniform float uTime;
uniform float uSunDisc;
varying vec3 vDir;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 col = mix(uHorizon, uZenith, t);

  // sun glow (mie-ish) + disc
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlow * (pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 0.6) * smoothstep(-0.25, 0.1, uSunDir.y + 0.2);
  col += uGlow * smoothstep(0.9994, 0.99975, sd) * 14.0 * uSunDisc;

  // stars
  if (uStars > 0.0 && h > 0.0) {
    vec2 sp = d.xz / (h + 0.35) * 260.0;
    float st = hash(floor(sp));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0);
    col += vec3(0.85, 0.9, 1.0) * step(0.9965, st) * tw * smoothstep(0.02, 0.25, h) * uStars * 1.4;
  }

  // clouds on a virtual plane
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.09) * 1.15 + vec2(uTime * 0.0035, uTime * 0.0012);
    float n = fbm(cp * 1.4);
    float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.28, n);
    float edge = smoothstep(1.0 - uCover, 1.0 - uCover + 0.55, fbm(cp * 1.4 + uSunDir.xz * 0.08));
    vec3 cc = mix(uCloudLit, uCloudShade, edge * 0.9);
    cc += uGlow * pow(sd, 10.0) * (1.0 - edge) * 0.8; // silver lining
    col = mix(col, cc, c * smoothstep(0.0, 0.16, h) * 0.95);
  }

  // melt the horizon into the fog colour so terrain silhouettes match
  col = mix(col, uFog, 1.0 - smoothstep(-0.02, 0.14, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly sunDir = new THREE.Vector3();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() },
        uSunDir: { value: this.sunDir },
        uGlow: { value: new THREE.Color() },
        uCloudLit: { value: new THREE.Color() },
        uCloudShade: { value: new THREE.Color() },
        uCover: { value: 0.5 },
        uStars: { value: 0 },
        uTime: { value: 0 },
        uSunDisc: { value: 1 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  apply(p: SkyPreset, night: boolean) {
    const u = this.material.uniforms;
    u.uZenith.value.set(p.zenith);
    u.uHorizon.value.set(p.horizon);
    u.uFog.value.set(p.fog);
    u.uGlow.value.set(p.glow);
    u.uCloudLit.value.set(p.cloudLit);
    u.uCloudShade.value.set(p.cloudShade);
    u.uCover.value = p.cloudCover;
    u.uStars.value = p.stars;
    u.uSunDisc.value = night ? 0.25 : 1;
    const el = THREE.MathUtils.degToRad(p.sunElevation);
    const az = THREE.MathUtils.degToRad(p.sunAzimuth);
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }

  update(time: number, camera: THREE.Camera) {
    this.material.uniforms.uTime.value = time;
    this.mesh.position.copy(camera.position);
  }
}
