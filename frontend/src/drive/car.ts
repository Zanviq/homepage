import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clamp, lerp } from "./noise";
import type { CarPhysics } from "./physics";

export const ASSET_BASE = "/drive-assets";

interface Spring {
  x: number;
  v: number;
}
function spring(s: Spring, target: number, k: number, d: number, dt: number) {
  const a = (target - s.x) * k - s.v * d;
  s.v += a * dt;
  s.x += s.v * dt;
}

export class CarVisual {
  readonly root = new THREE.Group(); // on the ground, yaw + terrain tilt
  readonly body = new THREE.Group(); // sprung mass: pitch / roll / heave
  readonly bodyMaterial: THREE.MeshPhysicalMaterial;
  private wheels: { pivot: THREE.Object3D; wheel: THREE.Object3D; front: boolean; left: boolean }[] = [];
  private steering?: THREE.Object3D;
  private steeringBase = new THREE.Quaternion();
  private tailMat?: THREE.MeshStandardMaterial;
  private headMat?: THREE.MeshStandardMaterial;
  private drlMat?: THREE.MeshStandardMaterial;
  private shiftMat?: THREE.MeshStandardMaterial;
  readonly headlights: THREE.SpotLight[] = [];
  private pitch: Spring = { x: 0, v: 0 };
  private roll: Spring = { x: 0, v: 0 };
  private heave: Spring = { x: 0, v: 0 };
  lightsOn = false;
  readonly exhaust = [new THREE.Vector3(0.42, 0.42, 2.25), new THREE.Vector3(-0.42, 0.42, 2.25)];
  readonly rearWheels = [new THREE.Vector3(0.82, 0, 1.5), new THREE.Vector3(-0.82, 0, 1.5)];
  readonly frontWheels = [new THREE.Vector3(0.84, 0, -1.16), new THREE.Vector3(-0.84, 0, -1.16)];

  constructor(color: string) {
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.9,
      roughness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    this.root.add(this.body);
  }

  async load(manager: THREE.LoadingManager, highQuality: boolean) {
    const draco = new DRACOLoader(manager);
    draco.setDecoderPath(`${ASSET_BASE}/draco/`);
    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(draco);
    const [gltf, ao] = await Promise.all([
      loader.loadAsync(`${ASSET_BASE}/ferrari.glb`),
      new THREE.TextureLoader(manager).loadAsync(`${ASSET_BASE}/ferrari_ao.png`),
    ]);
    const model = gltf.scene.children[0] as THREE.Object3D;

    const details = new THREE.MeshStandardMaterial({ color: "#d8dadd", metalness: 1, roughness: 0.28 });
    // Tinted glass that reflects the sky. (Physical transmission would re-render
    // the whole scene every frame, which a forest of trees makes very costly.)
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#10151a",
      metalness: 0.2,
      roughness: 0.03,
      transparent: true,
      opacity: highQuality ? 0.42 : 0.5,
      envMapIntensity: 1.6,
      depthWrite: false,
    });

    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      switch (mat.name) {
        case "Body_Color":
          m.material = this.bodyMaterial;
          break;
        case "Glass_Gray":
          m.material = glass;
          m.castShadow = false;
          break;
        case "metal_chrome":
          m.material = details;
          break;
        case "Taillight_Glass":
          if (o.name === "steering_red_lights") {
            this.shiftMat ??= (mat.clone() as THREE.MeshStandardMaterial);
            m.material = this.shiftMat;
          } else {
            this.tailMat ??= mat;
            mat.emissive = new THREE.Color("#ff1a10");
            mat.emissiveIntensity = 0;
          }
          break;
        case "Projector_Glass":
          this.headMat = mat;
          mat.emissive = new THREE.Color("#fff4e0");
          mat.emissiveIntensity = 0;
          break;
        case "Turn_Signal_LED":
          this.drlMat = mat;
          mat.emissive = new THREE.Color("#ffffff");
          mat.emissiveIntensity = 0.6;
          break;
      }
      if (o.name.startsWith("rim_") || o.name === "trim") m.material = details;
    });
    if (this.shiftMat) {
      this.shiftMat.emissive = new THREE.Color("#ff2a1a");
      this.shiftMat.emissiveIntensity = 0;
    }

    // Re-parent: body + steering wheel ride on the springs; wheels stay on the axle.
    const parts = [...model.children];
    for (const child of parts) {
      if (child.name.startsWith("wheel_")) {
        const pivot = new THREE.Object3D();
        pivot.position.copy(child.position);
        child.position.set(0, 0, 0);
        pivot.add(child);
        this.root.add(pivot);
        this.wheels.push({
          pivot,
          wheel: child,
          front: child.name.endsWith("fl") || child.name.endsWith("fr"),
          left: child.name.endsWith("l"),
        });
      } else {
        this.body.add(child);
        if (child.name === "steering_wheel") {
          this.steering = child;
          this.steeringBase.copy(child.quaternion);
        }
      }
    }

    // soft contact shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
      new THREE.MeshBasicMaterial({
        map: ao,
        blending: THREE.MultiplyBlending,
        toneMapped: false,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.renderOrder = 2;
    this.root.add(shadow);

    // headlights
    for (const x of [0.62, -0.62]) {
      const l = new THREE.SpotLight("#fff1dc", 0, 120, 0.42, 0.6, 1.4);
      l.position.set(x, 0.68, -2.0);
      l.target.position.set(x * 2, -1.6, -32);
      this.body.add(l, l.target);
      this.headlights.push(l);
    }
  }

  setColor(hex: string) {
    this.bodyMaterial.color.set(hex);
  }

  setLights(on: boolean, strength = 1) {
    this.lightsOn = on;
    for (const l of this.headlights) l.intensity = on ? 150 * strength : 0;
    if (this.headMat) this.headMat.emissiveIntensity = on ? 3.5 : 0.1;
  }

  update(p: CarPhysics, brake: number, dt: number) {
    this.root.position.set(p.x, p.y, p.z);
    // yaw then terrain pitch/roll about the car's own axes
    this.root.rotation.set(0, 0, 0);
    this.root.rotation.order = "YXZ";
    this.root.rotation.y = p.heading;
    this.root.rotation.x = p.pitch; // + = nose up
    this.root.rotation.z = -p.roll; // + roll = left side up

    // suspension: squat/dive and body roll from accelerations
    spring(this.pitch, clamp(p.ax * 0.0065, -0.05, 0.05), 90, 11, dt);
    spring(this.roll, clamp(p.ay * 0.0075, -0.06, 0.06), 80, 10, dt);
    const bump = p.surface.kind === "road" ? 0 : Math.sin(performance.now() * 0.05) * 0.012 * Math.min(1, p.speed / 10);
    spring(this.heave, bump, 140, 12, dt);
    this.body.rotation.x = this.pitch.x; // squat under power, dive under braking
    this.body.rotation.z = -this.roll.x; // lean away from the turn
    this.body.position.y = this.heave.x;

    for (const w of this.wheels) {
      w.pivot.rotation.y = w.front ? p.steerAngle : 0;
      w.wheel.rotation.x = -Math.PI / 2 + (w.front ? p.frontSpin : p.rearSpin) * -1;
    }
    if (this.steering) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.steerAngle * 5.5);
      this.steering.quaternion.copy(this.steeringBase).multiply(q);
    }

    if (this.tailMat) {
      const base = this.lightsOn ? 1.2 : 0.05;
      this.tailMat.emissiveIntensity = lerp(this.tailMat.emissiveIntensity, brake > 0.1 ? 6 : base, 1 - Math.exp(-dt * 20));
    }
    if (this.shiftMat) this.shiftMat.emissiveIntensity = p.rpm > 7800 ? 4 : p.rpm > 6800 ? 1.2 : 0;
    if (this.drlMat) this.drlMat.emissiveIntensity = this.lightsOn ? 2.2 : 0.8;
  }

  worldPoint(local: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(local).applyMatrix4(this.root.matrixWorld);
  }
}
