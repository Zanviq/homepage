import * as THREE from "three";
import { clamp, lerp } from "./noise";
import type { CarPhysics } from "./physics";
import type { CameraMode } from "./types";

const MODES: CameraMode[] = ["chase", "far", "cockpit", "hood"];

/** Chase / far / cockpit / hood cameras with drag-to-look and shake. */
export class CameraRig {
  mode: CameraMode = "chase";
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0; // smoothed follow heading
  private orbitYaw = 0;
  private orbitPitch = 0;
  private lastDrag = -10;
  private shake = 0;
  private dragging = false;
  private px = 0;
  private py = 0;
  private initialised = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private el: HTMLElement,
  ) {}

  attach() {
    this.el.addEventListener("pointerdown", this.pd);
    window.addEventListener("pointermove", this.pm);
    window.addEventListener("pointerup", this.pu);
  }
  detach() {
    this.el.removeEventListener("pointerdown", this.pd);
    window.removeEventListener("pointermove", this.pm);
    window.removeEventListener("pointerup", this.pu);
  }
  private pd = (e: PointerEvent) => {
    if (e.pointerType === "touch") return; // touch uses on-screen controls
    this.dragging = true;
    this.px = e.clientX;
    this.py = e.clientY;
  };
  private pm = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.orbitYaw -= (e.clientX - this.px) * 0.006;
    this.orbitPitch = clamp(this.orbitPitch + (e.clientY - this.py) * 0.004, -0.35, 0.9);
    this.px = e.clientX;
    this.py = e.clientY;
    this.lastDrag = performance.now() / 1000;
  };
  private pu = () => {
    this.dragging = false;
  };

  cycle(): CameraMode {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    this.initialised = false;
    return this.mode;
  }

  addShake(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  snap() {
    this.initialised = false;
  }

  update(dt: number, car: CarPhysics, root: THREE.Object3D, groundAt: (x: number, z: number) => number, roughness: number) {
    const cam = this.camera;
    const now = performance.now() / 1000;
    if (!this.dragging && now - this.lastDrag > 1.4) {
      this.orbitYaw *= Math.exp(-dt * 2.5);
      this.orbitPitch *= Math.exp(-dt * 2.5);
    }
    const speed = car.speed;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const rumble = roughness * Math.min(1, speed / 20) * 0.02 + this.shake * 0.08;

    if (this.mode === "cockpit" || this.mode === "hood") {
      const eye = this.mode === "cockpit" ? new THREE.Vector3(-0.36, 1.06, 0.12) : new THREE.Vector3(0, 1.2, -0.55);
      root.updateMatrixWorld();
      eye.applyMatrix4(root.matrixWorld);
      const fwd = new THREE.Vector3(0, -0.06, -1).applyQuaternion(root.quaternion);
      fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.orbitYaw * 1.6);
      cam.position.copy(eye);
      cam.position.y += (Math.random() - 0.5) * rumble * 0.5;
      cam.lookAt(eye.clone().add(fwd));
      cam.near = this.mode === "cockpit" ? 0.05 : 0.15;
      cam.fov = lerp(cam.fov, this.mode === "cockpit" ? 68 : 72, 1 - Math.exp(-dt * 4));
      cam.updateProjectionMatrix();
      this.initialised = false;
      return;
    }

    const far = this.mode === "far";
    const dist = (far ? 10.5 : 6.2) + speed * 0.02;
    const height = far ? 3.7 : 2.05;
    // follow the direction of travel a bit when sliding, for a drift-cam feel
    const velHeading = speed > 4 ? Math.atan2(-(car.vx * -Math.sin(car.heading) + car.vy * -Math.cos(car.heading)), -(car.vx * -Math.cos(car.heading) + car.vy * Math.sin(car.heading))) : car.heading;
    const reversing = car.vx < -1;
    let targetYaw = car.heading;
    if (speed > 4 && !reversing) {
      let d = velHeading - car.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      targetYaw = car.heading + d * 0.45;
    }
    if (!this.initialised) {
      this.yaw = targetYaw;
    } else {
      let d = targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 5.5));
    }
    const yaw = this.yaw + this.orbitYaw;
    const pitch = this.orbitPitch;
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); // opposite of forward
    const target = new THREE.Vector3(car.x, car.y, car.z)
      .addScaledVector(back, dist * Math.cos(pitch))
      .add(new THREE.Vector3(0, height + dist * Math.sin(pitch), 0));
    const ground = groundAt(target.x, target.z) + 0.7;
    if (target.y < ground) target.y = ground;
    const lookAhead = new THREE.Vector3(car.x, car.y + 1.05, car.z).addScaledVector(back, -3.2);

    if (!this.initialised) {
      this.pos.copy(target);
      this.look.copy(lookAhead);
      this.initialised = true;
    } else {
      this.pos.lerp(target, 1 - Math.exp(-dt * 9));
      this.look.lerp(lookAhead, 1 - Math.exp(-dt * 14));
    }
    cam.position.copy(this.pos);
    cam.position.x += (Math.random() - 0.5) * rumble;
    cam.position.y += (Math.random() - 0.5) * rumble;
    cam.lookAt(this.look);
    cam.near = 0.2;
    cam.fov = lerp(cam.fov, 60 + Math.min(16, speed * 0.2), 1 - Math.exp(-dt * 3));
    cam.updateProjectionMatrix();
  }
}
