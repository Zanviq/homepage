import * as THREE from "three";

const MAX_MARKS = 2400;

/** Tyre marks left on the ground while a wheel slides. */
export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private cursor = 0;
  private last: (THREE.Vector3 | null)[] = [null, null, null, null];
  private geo: THREE.BufferGeometry;

  constructor() {
    this.pos = new Float32Array(MAX_MARKS * 4 * 3);
    this.col = new Float32Array(MAX_MARKS * 4 * 4);
    const idx = new Uint32Array(MAX_MARKS * 6);
    for (let i = 0; i < MAX_MARKS; i++) {
      idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 2, i * 4 + 3, i * 4 + 1], i * 6);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** wheel: 0..3, p = contact point on the ground, intensity 0..1 */
  add(wheel: number, p: THREE.Vector3, side: THREE.Vector3, intensity: number, dark: boolean) {
    const prev = this.last[wheel];
    if (intensity < 0.3) {
      this.last[wheel] = null;
      return;
    }
    if (!prev) {
      this.last[wheel] = p.clone();
      return;
    }
    if (prev.distanceToSquared(p) < 0.09) return;
    if (prev.distanceToSquared(p) > 9) {
      this.last[wheel] = p.clone();
      return;
    }
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_MARKS;
    const w = 0.13;
    const o = i * 12;
    this.pos.set(
      [
        prev.x - side.x * w, prev.y, prev.z - side.z * w,
        prev.x + side.x * w, prev.y, prev.z + side.z * w,
        p.x - side.x * w, p.y, p.z - side.z * w,
        p.x + side.x * w, p.y, p.z + side.z * w,
      ],
      o,
    );
    const a = Math.min(0.55, intensity * 0.6);
    const c = dark ? 0.03 : 0.22;
    for (let k = 0; k < 4; k++) this.col.set([c, c * 0.95, c * 0.9, a], i * 16 + k * 4);
    const posAttr = this.geo.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geo.attributes.color as THREE.BufferAttribute;
    posAttr.addUpdateRange(o, 12);
    colAttr.addUpdateRange(i * 16, 16);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    prev.copy(p);
  }

  break() {
    this.last = [null, null, null, null];
  }
}

const MAX_PARTICLES = 420;

const pVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = min(aSize * uScale / -mvPosition.z, uScale * 0.25);
  // fade puffs that drift right up to the camera instead of filling the screen
  vAlpha = aAlpha * smoothstep(1.5, 5.0, -mvPosition.z);
  vColor = aColor;
  #include <fog_vertex>
}`;
const pFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.1, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

interface Particle {
  alive: boolean;
  age: number;
  life: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  size: number;
  grow: number;
  alpha: number;
  color: THREE.Color;
}

/** Tyre smoke, dust and spray. */
export class Particles {
  readonly points: THREE.Points;
  private parts: Particle[] = [];
  private geo: THREE.BufferGeometry;
  private next = 0;
  readonly material: THREE.ShaderMaterial;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.parts.push({
        alive: false,
        age: 0,
        life: 1,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        size: 1,
        grow: 1,
        alpha: 1,
        color: new THREE.Color(),
      });
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    uniforms.uScale = { value: 600 };
    this.material = new THREE.ShaderMaterial({
      vertexShader: pVert,
      fragmentShader: pFrag,
      uniforms,
      fog: true,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, size: number, life: number, alpha: number, grow = 3) {
    const q = this.parts[this.next];
    this.next = (this.next + 1) % MAX_PARTICLES;
    q.alive = true;
    q.age = 0;
    q.life = life;
    q.p.copy(p);
    q.v.copy(v);
    q.size = size;
    q.grow = grow;
    q.alpha = alpha;
    q.color.copy(color);
  }

  update(dt: number, viewportHeight: number) {
    this.material.uniforms.uScale.value = viewportHeight * 0.9;
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const size = this.geo.attributes.aSize as THREE.BufferAttribute;
    const alpha = this.geo.attributes.aAlpha as THREE.BufferAttribute;
    const col = this.geo.attributes.aColor as THREE.BufferAttribute;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const q = this.parts[i];
      if (!q.alive) {
        alpha.setX(i, 0);
        continue;
      }
      q.age += dt;
      if (q.age >= q.life) {
        q.alive = false;
        alpha.setX(i, 0);
        continue;
      }
      const t = q.age / q.life;
      q.v.multiplyScalar(Math.exp(-dt * 1.6));
      q.v.y += dt * 0.6;
      q.p.addScaledVector(q.v, dt);
      pos.setXYZ(i, q.p.x, q.p.y, q.p.z);
      size.setX(i, q.size * (1 + t * q.grow));
      alpha.setX(i, q.alpha * (1 - t) * Math.min(1, t * 8));
      col.setXYZ(i, q.color.r, q.color.g, q.color.b);
    }
    pos.needsUpdate = true;
    size.needsUpdate = true;
    alpha.needsUpdate = true;
    col.needsUpdate = true;
  }
}
