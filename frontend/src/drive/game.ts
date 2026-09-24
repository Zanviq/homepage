import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Lang } from "@/lib/types";
import { CarAudio } from "./audio";
import { CameraRig } from "./camera";
import { ASSET_BASE, CarVisual } from "./car";
import { Colliders } from "./collision";
import { Particles, SkidMarks } from "./effects";
import { Grass } from "./grass";
import { Input, type Action } from "./input";
import { buildLake, terrainMaterial, type Lake } from "./materials";
import { clamp, lerp, mulberry32 } from "./noise";
import { CarPhysics, SURFACES, type PhysicsWorld, type Surface } from "./physics";
import { buildDelineators, buildGuardrails, buildMarkings, buildRoadSurface, buildStreetLights, type RailSection, type StreetLights } from "./road";
import { buildSigns, type Fonts, type SignSystem } from "./signs";
import { PRESETS, Sky } from "./sky";
import { buildFarTerrain, padDistance, Terrain, type Pad } from "./terrain";
import { DRIVE_LIMIT, inLakeBasin, LAKE, ROAD_HALF, WATER_LEVEL, WORLD_HALF } from "./constants";
import { Track } from "./track";
import type { CameraMode, DriveContent, GameSettings, Poi, Quality, TimeOfDay } from "./types";
import { buildVegetation, type Vegetation } from "./vegetation";

export interface HudRefs {
  speed?: HTMLElement | null;
  gear?: HTMLElement | null;
  rpm?: HTMLElement | null;
  lap?: HTMLElement | null;
  minimap?: HTMLCanvasElement | null;
}

export interface GameEvents {
  progress(p: number, label: string): void;
  near(poi: Poi | null): void;
  discover(poi: Poi, found: number, total: number): void;
  open(poi: Poi): void;
  toast(text: string): void;
  lap(time: number, best: number, record: boolean): void;
  camera(mode: CameraMode): void;
  action(a: Action): void;
}

const STEP = 1 / 120;
const DISCOVER_KEY = "zanviq-drive-discovered";
const BEST_KEY = "zanviq-drive-best";

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function formatLap(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.2, 16000);
  composer!: EffectComposer;
  bloom!: UnrealBloomPass;
  private sky = new Sky();
  sun = new THREE.DirectionalLight("#ffffff", 3);
  private hemi = new THREE.HemisphereLight("#ffffff", "#444444", 1);
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  readonly track = new Track();
  private terrain!: Terrain;
  private pad!: Pad;
  private colliders = new Colliders();
  private signs!: SignSystem;
  veg!: Vegetation;
  grass!: Grass;
  lake!: Lake;
  private lamps!: StreetLights;
  private lampPool: THREE.PointLight[] = [];
  private reflectors?: THREE.InstancedMesh;
  car: CarVisual;
  readonly physics = new CarPhysics();
  readonly input = new Input();
  private rig: CameraRig;
  private skid = new SkidMarks();
  private particles = new Particles();
  private audio: CarAudio | null = null;
  private world!: PhysicsWorld;
  pois: Poi[] = [];
  discovered = new Set<string>();
  private nearPoi: Poi | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private running = false;
  paused = false;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private hud: HudRefs = {};
  private minimapBase: HTMLCanvasElement | null = null;
  private frameNo = 0;
  // lap timing
  private lapStart = -1;
  private lapSectors = new Set<number>();
  private lastS = 0;
  lap = 0;
  best: number | null = null;
  // adaptive resolution
  private ftAcc = 0;
  private ftCount = 0;
  private pixelRatio = 1;
  private maxPixelRatio = 1;
  private lastLampUpdate = 0;
  private hudCache = { speed: "", gear: "", rpm: "", lap: "" };
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private rand = mulberry32(99);

  constructor(
    private container: HTMLElement,
    private content: DriveContent,
    public settings: GameSettings,
    private fonts: Fonts,
    private events: GameEvents,
  ) {
    const high = settings.quality === "high";
    if (process.env.NODE_ENV !== "production") (window as unknown as { __THREE?: typeof THREE }).__THREE = THREE;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1.25);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.car = new CarVisual(settings.carColor);
    this.rig = new CameraRig(this.camera, this.renderer.domElement);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    try {
      const saved = JSON.parse(localStorage.getItem(DISCOVER_KEY) || "[]");
      if (Array.isArray(saved)) saved.forEach((id) => this.discovered.add(String(id)));
      const best = Number(localStorage.getItem(BEST_KEY));
      if (best > 0) this.best = best;
    } catch {
      /* ignore */
    }
  }

  setHud(refs: HudRefs) {
    this.hud = refs;
  }

  // ── build ──────────────────────────────────────────────────────────────

  async init() {
    const high = this.settings.quality === "high";
    const ev = this.events;
    const manager = new THREE.LoadingManager();
    let assetFrac = 0;
    manager.onProgress = (_url, loaded, total) => {
      assetFrac = total ? loaded / total : 0;
      ev.progress(0.1 + assetFrac * 0.45, "assets");
    };
    ev.progress(0.02, "assets");

    const texLoader = new THREE.TextureLoader(manager);
    const tex = (name: string, srgb = true) => {
      const t = texLoader.load(`${ASSET_BASE}/tex/${name}.jpg`);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const textures = {
      asphalt: tex("asphalt_diff"),
      asphaltN: tex("asphalt_nor", false),
      asphaltR: tex("asphalt_rough", false),
      grass: tex("grass_diff"),
      grassN: tex("grass_nor", false),
      ground: tex("ground_diff"),
      groundN: tex("ground_nor", false),
      rock: tex("rock_diff"),
      rockN: tex("rock_nor", false),
      gravel: tex("gravel_diff"),
      water: tex("waternormals", false),
    };
    const carLoad = this.car.load(manager, high);
    const fontLoad = Promise.all([
      document.fonts.load(`800 64px ${this.fonts.latin}`),
      document.fonts.load(`600 64px ${this.fonts.latin}`),
      document.fonts.load(`800 64px ${this.fonts.korean}`, "한글"),
      document.fonts.load(`600 64px ${this.fonts.korean}`, "한글"),
    ]).catch(() => undefined);

    await frame();
    // lookout pad beside the lake
    const lakeHit = this.track.nearest(LAKE.x, LAKE.z);
    const li = lakeHit.i;
    const nx = LAKE.x - this.track.px[li];
    const nz = LAKE.z - this.track.pz[li];
    const nl = Math.hypot(nx, nz);
    const padDist = ROAD_HALF + 12.5;
    this.pad = {
      x: this.track.px[li] + (nx / nl) * padDist,
      z: this.track.pz[li] + (nz / nl) * padDist,
      angle: Math.atan2(nx / nl, nz / nl),
      hx: 17,
      hz: 10,
      y: this.track.py[li] + 0.05,
    };
    ev.progress(0.06, "terrain");
    await frame();
    this.terrain = new Terrain(this.track, [this.pad]);
    ev.progress(0.1, "terrain");
    await frame();

    this.world = {
      heightAt: (x, z) => this.groundHeight(x, z),
      normalAt: (x, z, out) => {
        const e = 1.2;
        const dx = this.groundHeight(x + e, z) - this.groundHeight(x - e, z);
        const dz = this.groundHeight(x, z + e) - this.groundHeight(x, z - e);
        return out.set(-dx, 2 * e, -dz).normalize();
      },
      surfaceAt: (x, z) => this.surfaceAt(x, z),
      colliders: this.colliders,
      limit: DRIVE_LIMIT,
    };

    await fontLoad;
    await Promise.all(Object.values(textures).map((t) => new Promise<void>((r) => {
      if (t.image) r();
      else {
        const check = () => (t.image ? r() : setTimeout(check, 50));
        check();
      }
    })));
    ev.progress(0.58, "world");
    await frame();

    // ── scene ──
    const s = this.scene;
    s.add(this.sky.mesh);
    const tMat = terrainMaterial(
      {
        grass: textures.grass,
        grassN: textures.grassN,
        ground: textures.ground,
        groundN: textures.groundN,
        rock: textures.rock,
        rockN: textures.rockN,
        gravel: textures.gravel,
      },
      high,
    );
    for (const m of this.terrain.buildMeshes(tMat, 10, high ? 1 : 2)) s.add(m);
    s.add(buildFarTerrain());
    s.add(buildRoadSurface(this.track, { diff: textures.asphalt, nor: textures.asphaltN, rough: textures.asphaltR }));
    s.add(buildMarkings(this.track));
    s.add(this.buildPad(textures.asphalt));
    ev.progress(0.64, "roads");
    await frame();

    const padS = this.track.nearest(this.pad.x, this.pad.z).s;
    const rails = this.railSections(padS);
    s.add(buildGuardrails(this.track, this.terrain, rails, this.colliders));
    const inRail = (sv: number) => rails.some((r) => sv >= r.s0 - 5 && sv <= r.s1 + 5);
    const delin = buildDelineators(this.track, this.terrain, (sv) => sv < 30 || inRail(sv) || Math.abs(sv - padS) < 40);
    this.reflectors = delin.userData.reflectors as THREE.InstancedMesh;
    s.add(delin);
    this.lamps = buildStreetLights(
      this.track,
      this.terrain,
      [
        [15, 560, 52],
        [padS - 70, padS + 70, 35],
      ],
      this.colliders,
    );
    s.add(this.lamps.group);
    for (let k = 0; k < 4; k++) {
      const l = new THREE.PointLight("#ffcf8a", 0, 38, 2);
      this.lampPool.push(l);
      s.add(l);
    }

    this.signs = buildSigns(this.track, this.terrain, this.content, this.fonts, this.pad, this.colliders);
    this.pois = this.signs.pois;
    s.add(this.signs.group);
    ev.progress(0.7, "signs");
    await frame();

    const keepClear = [
      ...this.pois.map((p) => ({ x: p.x, z: p.z, r: p.kind === "project" ? 17 : p.kind === "about" ? 14 : 6 })),
      ...this.lamps.heads.map((h) => ({ x: h.x, z: h.z, r: 4 })),
      { x: this.track.px[0], z: this.track.pz[0], r: 30 },
    ];
    this.veg = buildVegetation(
      { terrain: this.terrain, pads: [this.pad], keepClear, colliders: this.colliders, density: high ? 1 : 0.55, renderer: this.renderer },
      { diff: textures.rock, nor: textures.rockN },
    );
    s.add(this.veg.group);
    ev.progress(0.84, "forest");
    await frame();

    this.grass = new Grass(this.terrain.heightTexture, high ? 120000 : 45000, high ? 76 : 54);
    s.add(this.grass.mesh);
    this.lake = buildLake(textures.water, high);
    s.add(this.lake.mesh);
    s.add(this.skid.mesh, this.particles.points);

    // lights
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 1;
    sc.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target, this.hemi);

    await carLoad;
    s.add(this.car.root);
    ev.progress(0.92, "car");
    await this.signs.ready;
    this.signs.setLang(this.settings.lang);

    // composer
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: high ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
    this.bloom.enabled = high;
    // Firefly guard: a single over-bright or NaN pixel (a specular glint on a
    // thin pole, say) must not bloom into a big halo.
    const hp = this.bloom.materialHighPassFilter;
    hp.fragmentShader = hp.fragmentShader.replace(
      "vec4 texel = texture2D( tDiffuse, vUv );",
      `vec4 texel = texture2D( tDiffuse, vUv );
      if ( any( isnan( texel.rgb ) ) || any( isinf( texel.rgb ) ) ) texel.rgb = vec3( 0.0 );
      texel.rgb = min( texel.rgb, vec3( 2.5 ) );`,
    );
    hp.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildMinimapBase();
    this.applyTime(this.settings.timeOfDay);
    this.physics.assist = this.settings.assist;
    this.physics.onImpact = (e) => {
      this.rig.addShake(Math.min(1, e.speed / 12));
      this.audio?.impact(e.speed);
      this.skid.break();
    };
    this.placeAtS(this.track.length - 26);
    this.resize();

    this.input.onAction = (a) => this.handleAction(a);
    this.input.attach();
    this.rig.attach();

    // compile shaders up front so the first seconds don't hitch
    this.rig.update(0.016, this.physics, this.car.root, (x, z) => this.groundHeight(x, z), 0);
    this.renderer.compile(s, this.camera);
    this.composer.render();
    ev.progress(1, "ready");
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private buildPad(asphalt: THREE.Texture): THREE.Group {
    const p = this.pad;
    const g = new THREE.Group();
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 640;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#7b7b78";
    ctx.fillRect(0, 0, 1024, 640);
    ctx.strokeStyle = "#f0efe8";
    ctx.lineWidth = 7;
    // bays along the lake side (canvas y=0 is the lake edge)
    const bays = 9;
    for (let k = 0; k <= bays; k++) {
      const x = 90 + (k * (1024 - 180)) / bays;
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(90, 300);
    ctx.lineTo(934, 300);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const aTex = asphalt.clone();
    aTex.repeat.set((p.hx * 2) / 4.5, (p.hz * 2) / 4.5);
    aTex.wrapS = aTex.wrapT = THREE.RepeatWrapping;
    aTex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(p.hx * 2, p.hz * 2);
    geo.rotateX(-Math.PI / 2);
    // canvas top (v = 1) should face the lake (+local z)
    geo.rotateY(Math.PI);
    const base = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: aTex, color: "#8a8a8a", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    );
    const lines = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        roughness: 0.8,
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      }),
    );
    lines.material = new THREE.MeshStandardMaterial({
      alphaMap: this.linesAlpha(c),
      color: "#efeee6",
      transparent: true,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    base.receiveShadow = lines.receiveShadow = true;
    lines.position.y = 0.005;
    g.add(base, lines);
    g.position.set(p.x, p.y + 0.03, p.z);
    g.rotation.y = p.angle;

    // wooden fence along the lake edge
    const fenceMat = new THREE.MeshStandardMaterial({ color: "#6f5842", roughness: 0.9 });
    const postGeo = new THREE.BoxGeometry(0.14, 1.1, 0.14);
    postGeo.translate(0, 0.55, 0);
    const n = 12;
    const posts = new THREE.InstancedMesh(postGeo, fenceMat, n);
    const cs = Math.cos(p.angle);
    const sn = Math.sin(p.angle);
    const ex = sn * (p.hz + 0.3);
    const ez = cs * (p.hz + 0.3);
    const tx = cs;
    const tz = -sn;
    for (let k = 0; k < n; k++) {
      const u = -p.hx + (k * 2 * p.hx) / (n - 1);
      const x = p.x + ex + tx * u;
      const z = p.z + ez + tz * u;
      posts.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, this.terrain.heightAt(x, z) - 0.05, z));
    }
    posts.castShadow = true;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(p.hx * 2, 0.1, 0.08), fenceMat);
    rail.position.set(p.x + ex, p.y + 0.95, p.z + ez);
    rail.rotation.y = p.angle;
    rail.castShadow = true;
    const rail2 = rail.clone();
    rail2.position.y -= 0.42;
    this.scene.add(posts, rail, rail2);
    this.colliders.addSegment(p.x + ex - tx * p.hx, p.z + ez - tz * p.hx, p.x + ex + tx * p.hx, p.z + ez + tz * p.hx, "rail");
    return g;
  }

  private linesAlpha(src: HTMLCanvasElement) {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    const s = src.getContext("2d")!.getImageData(0, 0, src.width, src.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < s.data.length; i += 4) {
      const v = s.data[i] > 200 ? 255 : 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }

  /** Guardrails on the outside of long bends, skipping the lookout entrance. */
  private railSections(padS: number): RailSection[] {
    const t = this.track;
    const out: RailSection[] = [];
    let start = -1;
    let sign = 0;
    for (let i = 0; i <= t.count; i++) {
      const k = i % t.count;
      const cur = t.curvature[k];
      const tight = Math.abs(cur) > 1 / 150;
      if (tight && start < 0) {
        start = i;
        sign = Math.sign(cur);
      } else if ((!tight || Math.sign(cur) !== sign) && start >= 0) {
        const s0 = t.sOf(start) - 18;
        const s1 = t.sOf(i) + 18;
        if (s1 - s0 > 70) out.push({ s0, s1, side: sign > 0 ? -1 : 1 });
        start = tight ? i : -1;
        sign = Math.sign(cur);
      }
    }
    // split around the lookout so cars can pull in
    const res: RailSection[] = [];
    for (const r of out) {
      if (padS > r.s0 - 40 && padS < r.s1 + 40) {
        if (padS - 40 - r.s0 > 30) res.push({ ...r, s1: padS - 40 });
        if (r.s1 - (padS + 40) > 30) res.push({ ...r, s0: padS + 40 });
      } else if (r.s0 > 20 && r.s1 < t.length - 20) res.push(r);
    }
    return res;
  }

  // ── world queries ──────────────────────────────────────────────────────

  private roadHit = { i: 0, s: 0, dist: 0, lateral: 0, y: 0 };

  groundHeight(x: number, z: number): number {
    let h = this.terrain.heightAt(x, z);
    const d = this.terrain.roadDistanceAt(x, z);
    if (d < ROAD_HALF + 1.2) {
      const hit = this.track.nearest(x, z, this.roadHit);
      if (hit.dist < ROAD_HALF + 0.6) {
        const ry = hit.y + 0.02 + 0.05 * (1 - Math.min(1, hit.dist / ROAD_HALF));
        h = hit.dist <= ROAD_HALF ? ry : lerp(ry, Math.min(h, ry), (hit.dist - ROAD_HALF) / 0.6);
      }
    }
    if (padDistance(this.pad, x, z) < 0) h = Math.max(h, this.pad.y + 0.03);
    return h;
  }

  private surfaceAt(x: number, z: number): Surface {
    if (inLakeBasin(x, z) && this.terrain.heightAt(x, z) < WATER_LEVEL - 0.35) return SURFACES.water;
    const d = this.terrain.roadDistanceAt(x, z);
    if (d < ROAD_HALF + 0.3 || padDistance(this.pad, x, z) < 0) return SURFACES.road;
    if (d < ROAD_HALF + 3.2) return SURFACES.gravel;
    return this.terrain.slopeAt(x, z) > 0.2 ? SURFACES.dirt : SURFACES.grass;
  }

  // ── settings ───────────────────────────────────────────────────────────

  applyTime(tod: TimeOfDay) {
    this.settings.timeOfDay = tod;
    const p = PRESETS[tod];
    this.sky.apply(p, tod === "night");
    this.scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.renderer.toneMappingExposure = p.exposure;
    // environment map from the sky itself so paint reflections match
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.sky.material));
    this.sky.material.uniforms.uTime.value = this.time;
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = p.envIntensity;
    const ambient = new THREE.Color(p.hemiSky).multiplyScalar(p.hemiIntensity * 0.55);
    this.grass?.setLighting(this.sky.sunDir, new THREE.Color(p.sunColor).multiplyScalar(Math.min(1.3, p.sunIntensity * 0.4)), ambient);
    this.lake?.setSun(this.sky.sunDir, new THREE.Color(p.sunColor), true);
    const night = tod === "night";
    this.signs?.setGlow(night ? 0.32 : tod === "dusk" ? 0.1 : 0, night ? 0.95 : tod === "dusk" ? 0.32 : 0.04);
    if (this.lamps) this.lamps.lampMaterial.emissiveIntensity = p.lampGlow * 4;
    if (this.reflectors) (this.reflectors.material as THREE.MeshStandardMaterial).emissiveIntensity = night ? 1.6 : tod === "dusk" ? 0.25 : 0;
    if (this.bloom) this.bloom.threshold = night ? 0.85 : 1.15;
    this.car.setLights(p.headlights, night ? 1 : 0.35);
    for (const l of this.lampPool) l.intensity = night ? 160 : tod === "dusk" ? 45 : 0;
  }

  setQuality(q: Quality) {
    this.settings.quality = q;
    const high = q === "high";
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1.25);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    if (this.bloom) this.bloom.enabled = high;
    this.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    const geo = this.grass?.mesh.geometry as THREE.InstancedBufferGeometry | undefined;
    if (geo) geo.instanceCount = Math.min(high ? 120000 : 45000, (geo.attributes.aOffset as THREE.InstancedBufferAttribute).count);
    this.resize();
  }

  setLang(lang: Lang) {
    this.settings.lang = lang;
    this.signs?.setLang(lang);
  }

  setCarColor(hex: string) {
    this.settings.carColor = hex;
    this.car.setColor(hex);
  }

  setAssist(on: boolean) {
    this.settings.assist = on;
    this.physics.assist = on;
  }

  setSound(on: boolean) {
    this.settings.sound = on;
    this.audio?.setMuted(!on);
  }

  // ── gameplay ───────────────────────────────────────────────────────────

  /** Called from the start button (a user gesture, so audio may start). */
  startEngine() {
    if (!this.audio) {
      try {
        this.audio = new CarAudio();
      } catch {
        this.audio = null;
      }
    }
    this.audio?.resume();
    this.audio?.setMuted(!this.settings.sound);
    this.running = true;
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.input.enabled = !p;
  }

  setInputEnabled(on: boolean) {
    this.input.enabled = on;
  }

  private handleAction(a: Action) {
    if (!this.running) return;
    switch (a) {
      case "camera":
        this.events.camera(this.rig.cycle());
        break;
      case "reset":
        this.resetToRoad();
        break;
      case "interact":
        if (this.nearPoi && this.input.enabled) this.events.open(this.nearPoi);
        else this.events.action(a);
        break;
      case "lights":
        this.car.setLights(!this.car.lightsOn, this.settings.timeOfDay === "night" ? 1 : 0.35);
        break;
      default:
        this.events.action(a);
    }
  }

  cycleCamera() {
    this.events.camera(this.rig.cycle());
  }

  interact() {
    if (this.nearPoi) this.events.open(this.nearPoi);
  }

  placeAtS(s: number, lateral = -LANE_OFFSET_PLAYER) {
    const i = this.track.indexAt(s);
    const t = this.track;
    const x = t.px[i] + t.leftX(i) * lateral;
    const z = t.pz[i] + t.leftZ(i) * lateral;
    this.physics.place(x, z, t.headingAt(i), this.world);
    this.lastS = t.sOf(i);
    this.skid.break();
    this.rig.snap();
  }

  resetToRoad() {
    const hit = this.track.nearest(this.physics.x, this.physics.z);
    this.placeAtS(hit.s);
    this.events.toast(this.settings.lang === "ko" ? "도로로 복귀했어요" : "Back on the road");
  }

  teleport(poi: Poi) {
    this.placeAtS(poi.s - (poi.kind === "project" ? 55 : 35));
  }

  // ── loop ───────────────────────────────────────────────────────────────

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dtRaw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, dtRaw);
    this.time += dt;
    this.frameNo++;

    const p = this.physics;
    const active = this.running && !this.paused;
    const c = this.input.update(dt, p.speed);
    if (active) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 8) {
        p.step(STEP, c, this.world);
        this.acc -= STEP;
        n++;
      }
      if (n === 8) this.acc = 0;
      this.gameLogic(dt);
    }

    const braking = (p.vx > 0.5 && c.brake > 0.1) || (p.vx < -0.5 && c.throttle > 0.1) || c.handbrake;
    this.car.update(p, braking ? 1 : 0, dt);
    this.rig.update(dt, p, this.car.root, (x, z) => this.groundHeight(x, z), p.surface.kind === "road" ? 0 : 1);

    this.sky.update(this.time, this.camera);
    this.veg.wind.uTime.value = this.time;
    this.veg.update(this.camera);
    this.car.root.getWorldPosition(this.tmpV);
    this.grass.update(this.time, this.camera, this.tmpV);
    this.lake.update(this.time);
    this.effects(dt, active);
    this.particles.update(dt, this.renderer.domElement.height);

    // sun + shadow camera follow the car (snapped to reduce shimmering)
    const cx = Math.round(p.x);
    const cz = Math.round(p.z);
    this.sun.target.position.set(cx, p.y, cz);
    this.sun.position.set(cx, p.y, cz).addScaledVector(this.sky.sunDir, 400);

    if (now - this.lastLampUpdate > 400) {
      this.lastLampUpdate = now;
      this.updateLampPool();
    }
    if (this.audio && this.running) {
      this.audio.update(p.rpm, active ? p.throttleOut : 0, p.gear, p.speed, Math.max(p.slipRear, p.slipFront), p.surface.kind !== "road");
    }
    this.updateHud();
    if (this.frameNo % 2 === 0) this.drawMinimap();
    this.composer.render();
    this.adaptResolution(dtRaw);
  };

  private gameLogic(dt: number) {
    const p = this.physics;
    // points of interest
    let near: Poi | null = null;
    let nearD = Infinity;
    for (const poi of this.pois) {
      const d = Math.hypot(poi.x - p.x, poi.z - p.z);
      const reach = poi.kind === "project" ? 38 : poi.kind === "about" ? 30 : poi.kind === "start" ? 24 : 26;
      if (d < reach && !this.discovered.has(poi.id)) {
        this.discovered.add(poi.id);
        try {
          localStorage.setItem(DISCOVER_KEY, JSON.stringify([...this.discovered]));
        } catch {
          /* ignore */
        }
        this.events.discover(poi, this.discovered.size, this.pois.length);
      }
      if (d < reach && d < nearD) {
        near = poi;
        nearD = d;
      }
    }
    if (near !== this.nearPoi) {
      this.nearPoi = near;
      this.events.near(near);
    }

    // laps: cross the start line having covered every sector
    const hit = this.track.nearest(p.x, p.z, this.roadHit);
    const L = this.track.length;
    const sNow = ((hit.s % L) + L) % L;
    if (hit.dist < 40) {
      this.lapSectors.add(Math.floor((sNow / L) * 10));
      const crossed = this.lastS > L - 60 && sNow < 60;
      if (crossed && p.vx > 0) {
        if (this.lapStart >= 0 && this.lapSectors.size >= 9) {
          const lapTime = this.time - this.lapStart;
          const record = this.best === null || lapTime < this.best;
          if (record) {
            this.best = lapTime;
            try {
              localStorage.setItem(BEST_KEY, String(lapTime));
            } catch {
              /* ignore */
            }
          }
          this.lap++;
          this.events.lap(lapTime, this.best ?? lapTime, record);
        }
        this.lapStart = this.time;
        this.lapSectors.clear();
      }
      this.lastS = sNow;
    }

    if (p.inWater > 1.8) {
      this.resetToRoad();
      this.events.toast(this.settings.lang === "ko" ? "물에 빠져서 도로로 옮겼어요" : "Fished out of the lake");
    }
    void dt;
  }

  private effects(dt: number, active: boolean) {
    if (!active) return;
    const p = this.physics;
    const root = this.car.root;
    root.updateMatrixWorld();
    const side = this.tmpV2.set(1, 0, 0).transformDirection(root.matrixWorld);
    const speed = p.speed;
    const surf = p.surface.kind;
    const onRoad = surf === "road";
    const wheels = [...this.car.rearWheels, ...this.car.frontWheels];
    wheels.forEach((w, k) => {
      const wp = this.car.worldPoint(w, this.tmpV);
      const slip = k < 2 ? p.slipRear : p.slipFront;
      wp.y = this.groundHeight(wp.x, wp.z) + 0.028;
      if (speed > 2 || (k < 2 && p.wheelspin > 0.3)) this.skid.add(k, wp, side, onRoad ? slip : Math.min(1, speed / 12) * 0.5, onRoad);
      else this.skid.add(k, wp, side, 0, onRoad);
      // tyre smoke on tarmac, dust off it, spray in water
      const r = this.rand;
      if (onRoad && k < 2 && slip > 0.45 && r() < 0.55) {
        this.particles.emit(
          wp.clone().add(new THREE.Vector3(0, 0.25, 0)),
          new THREE.Vector3((r() - 0.5) * 1.5, 0.6 + r(), (r() - 0.5) * 1.5),
          new THREE.Color(0.78, 0.78, 0.8),
          1.1 + r() * 0.8,
          1.4 + r(),
          0.26 * slip,
          2.6,
        );
      } else if (!onRoad && surf !== "water" && speed > 4 && r() < Math.min(0.5, speed / 40)) {
        this.particles.emit(
          wp.clone().add(new THREE.Vector3(0, 0.2, 0)),
          new THREE.Vector3((r() - 0.5) * 2, 0.5 + r() * 0.8, (r() - 0.5) * 2),
          surf === "gravel" ? new THREE.Color(0.55, 0.52, 0.48) : new THREE.Color(0.42, 0.36, 0.26),
          1.0 + r() * 0.8,
          1.2 + r(),
          0.35,
          3.5,
        );
      } else if (surf === "water" && speed > 1 && r() < 0.6) {
        this.particles.emit(
          wp.clone().add(new THREE.Vector3(0, 0.2, 0)),
          new THREE.Vector3((r() - 0.5) * 3, 1.5 + r() * 2, (r() - 0.5) * 3),
          new THREE.Color(0.85, 0.9, 0.95),
          0.8,
          0.8,
          0.5,
          2,
        );
      }
    });
    void dt;
  }

  private updateLampPool() {
    const heads = this.lamps.heads;
    const p = this.physics;
    const sorted = heads
      .map((h) => ({ h, d: (h.x - p.x) ** 2 + (h.z - p.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lampPool.length);
    this.lampPool.forEach((l, k) => {
      const s = sorted[k];
      if (s) l.position.copy(s.h).add(new THREE.Vector3(0, -0.4, 0));
    });
  }

  private updateHud() {
    const p = this.physics;
    const h = this.hud;
    const speed = String(Math.round(p.speed * 3.6));
    const gear = p.vx < -0.5 || (p.gear < 0 && p.speed < 0.5 && p.throttleOut > 0) ? "R" : p.speed < 0.3 && p.throttleOut === 0 ? "N" : String(p.gear);
    const rpmPct = `${Math.round(clamp((p.rpm - 800) / 8400, 0, 1) * 100)}%`;
    const lap = this.lapStart >= 0 ? formatLap(this.time - this.lapStart) : "–:––.––";
    if (h.speed && this.hudCache.speed !== speed) h.speed.textContent = this.hudCache.speed = speed;
    if (h.gear && this.hudCache.gear !== gear) h.gear.textContent = this.hudCache.gear = gear;
    if (h.rpm && this.hudCache.rpm !== rpmPct) {
      h.rpm.style.width = this.hudCache.rpm = rpmPct;
      h.rpm.dataset.red = p.rpm > 7800 ? "1" : "0";
    }
    if (h.lap && this.hudCache.lap !== lap) h.lap.textContent = this.hudCache.lap = lap;
  }

  // ── minimap ────────────────────────────────────────────────────────────

  private buildMinimapBase() {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d")!;
    const V = this.terrain.size;
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wx = (x / S) * WORLD_HALF * 2 - WORLD_HALF;
        const wz = (y / S) * WORLD_HALF * 2 - WORLD_HALF;
        const h = this.terrain.heightAt(wx, wz);
        const o = (y * S + x) * 4;
        let r: number, g: number, b: number;
        if (h < WATER_LEVEL - 0.2 && inLakeBasin(wx, wz)) [r, g, b] = [38, 86, 110];
        else if (h > 160) [r, g, b] = [118, 116, 110];
        else {
          const t = clamp(h / 160, 0, 1);
          [r, g, b] = [lerp(58, 96, t), lerp(84, 92, t), lerp(46, 72, t)];
        }
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    void V;
    ctx.putImageData(img, 0, 0);
    const toC = (x: number) => ((x + WORLD_HALF) / (WORLD_HALF * 2)) * S;
    ctx.lineJoin = "round";
    for (const [w, col] of [
      [11, "#1b1d20"],
      [6, "#e9e7df"],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= this.track.count; i += 2) {
        const k = i % this.track.count;
        const x = toC(this.track.px[k]);
        const y = toC(this.track.pz[k]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    this.minimapBase = c;
  }

  private poiColor(p: Poi) {
    return p.kind === "project" ? "#ff7a2f" : p.kind === "year" ? "#3c7df0" : p.kind === "about" ? "#1fb37a" : "#f4f4f0";
  }

  private drawMinimap() {
    const cv = this.hud.minimap;
    if (!cv || !this.minimapBase) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width;
    const H = cv.height;
    const p = this.physics;
    const S = this.minimapBase.width;
    const scale = S / (WORLD_HALF * 2); // px per metre on the base image
    const zoom = (W / 460) / scale; // show ~460 m across
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#23301f";
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2 + H * 0.12);
    ctx.rotate(p.heading);
    ctx.scale(zoom, zoom);
    const cx = (p.x + WORLD_HALF) * scale;
    const cz = (p.z + WORLD_HALF) * scale;
    ctx.drawImage(this.minimapBase, -cx, -cz);
    for (const poi of this.pois) {
      const x = (poi.x + WORLD_HALF) * scale - cx;
      const y = (poi.z + WORLD_HALF) * scale - cz;
      ctx.fillStyle = this.poiColor(poi);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(x, y, (poi.kind === "project" ? 7 : 5) / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    // car arrow
    ctx.save();
    ctx.translate(W / 2, H / 2 + H * 0.12);
    ctx.fillStyle = "#ff6a13";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Whole-world map for the map overlay. */
  drawFullMap(cv: HTMLCanvasElement) {
    const ctx = cv.getContext("2d");
    if (!ctx || !this.minimapBase) return;
    const W = cv.width;
    const H = cv.height;
    // frame the playable area
    const span = 1500;
    const s = Math.min(W, H) / span;
    const S = this.minimapBase.width;
    const scale = S / (WORLD_HALF * 2);
    ctx.save();
    ctx.fillStyle = "#1c2419";
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(s / scale, s / scale);
    ctx.drawImage(this.minimapBase, -S / 2, -S / 2);
    ctx.restore();
    const toX = (x: number) => W / 2 + x * s;
    const toY = (z: number) => H / 2 + z * s;
    for (const poi of this.pois) {
      ctx.fillStyle = this.poiColor(poi);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.globalAlpha = this.discovered.has(poi.id) ? 1 : 0.45;
      ctx.beginPath();
      ctx.arc(toX(poi.x), toY(poi.z), poi.kind === "project" ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const p = this.physics;
    ctx.save();
    ctx.translate(toX(p.x), toY(p.z));
    ctx.rotate(-p.heading);
    ctx.fillStyle = "#ff6a13";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ── housekeeping ───────────────────────────────────────────────────────

  private adaptResolution(dt: number) {
    if (!this.running || this.paused) return;
    this.ftAcc += dt;
    this.ftCount++;
    if (this.ftAcc < 2.5) return;
    const avg = this.ftAcc / this.ftCount;
    this.ftAcc = 0;
    this.ftCount = 0;
    let next = this.pixelRatio;
    if (avg > 1 / 42 && this.pixelRatio > 0.6) next = Math.max(0.6, this.pixelRatio - 0.15);
    else if (avg < 1 / 58 && this.pixelRatio < this.maxPixelRatio) next = Math.min(this.maxPixelRatio, this.pixelRatio + 0.1);
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.input.detach();
    this.rig.detach();
    this.audio?.dispose();
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

const LANE_OFFSET_PLAYER = 1.8;
