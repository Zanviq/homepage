// Rear-wheel-drive car on a planar bicycle model: tyre slip angles with a
// friction circle, weight transfer, 6-speed automatic gearbox, handbrake
// drifts, terrain slope and static collisions. Units: SI.

import * as THREE from "three";
import type { Colliders, Contact } from "./collision";
import { clamp, lerp, smoothstep } from "./noise";

export type SurfaceKind = "road" | "gravel" | "grass" | "dirt" | "water";

export interface Surface {
  kind: SurfaceKind;
  mu: number;
  roll: number; // rolling resistance coefficient
  drag: number; // extra speed-proportional drag (grass, water)
}

export const SURFACES: Record<SurfaceKind, Surface> = {
  road: { kind: "road", mu: 1.18, roll: 0.012, drag: 0 },
  gravel: { kind: "gravel", mu: 0.82, roll: 0.03, drag: 0.02 },
  dirt: { kind: "dirt", mu: 0.7, roll: 0.045, drag: 0.04 },
  grass: { kind: "grass", mu: 0.62, roll: 0.055, drag: 0.05 },
  water: { kind: "water", mu: 0.35, roll: 0.3, drag: 1.2 },
};

export interface PhysicsWorld {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: THREE.Vector3): THREE.Vector3;
  surfaceAt(x: number, z: number): Surface;
  colliders: Colliders;
  limit: number;
}

export interface Controls {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1, + = left
  handbrake: boolean;
}

const G = 9.81;
const MASS = 1480;
const IZ = 2350;
const CG_F = 1.31; // cg -> front axle
const CG_R = 1.35; // cg -> rear axle
const WB = CG_F + CG_R;
const CG_H = 0.46;
export const WHEEL_R = 0.36;
const C_F = 88000; // cornering stiffness, N/rad per axle
const C_R = 104000;
const DRAG = 0.39; // 0.5 * rho * Cd * A
const GEARS = [3.08, 2.19, 1.63, 1.29, 1.03, 0.84];
const REVERSE = 2.9;
const FINAL = 4.44;
const IDLE = 950;
const REDLINE = 8900;
const BRAKE_FORCE = 17500;

function torqueAt(rpm: number): number {
  // Nm, loosely shaped like a high-revving V8
  if (rpm < 1000) return 330;
  if (rpm < 6000) return lerp(360, 540, (rpm - 1000) / 5000);
  return lerp(540, 460, Math.min(1, (rpm - 6000) / 3000));
}

export interface ImpactEvent {
  speed: number;
  kind: string;
}

export class CarPhysics {
  // pose
  x = 0;
  z = 0;
  y = 0;
  heading = 0; // yaw, rotation about +y; forward = (-sin, -cos)
  pitch = 0; // terrain pitch (+ = nose up)
  roll = 0; // terrain roll (+ = left side up)
  // local velocity: vx forward, vy left; r yaw rate
  vx = 0;
  vy = 0;
  r = 0;
  // drivetrain
  gear = 1; // -1 reverse, 1..6
  rpm = IDLE;
  shiftTimer = 0;
  wheelspin = 0; // 0..1
  steerAngle = 0;
  // feedback for visuals/audio
  ax = 0; // smoothed longitudinal accel
  ay = 0; // smoothed lateral accel
  slipFront = 0; // 0..1 skid intensity
  slipRear = 0;
  frontSpin = 0; // wheel rotation angle (rad)
  rearSpin = 0;
  surface: Surface = SURFACES.road;
  inWater = 0; // seconds submerged
  throttleOut = 0;
  assist = true;

  private contact: Contact = { nx: 0, nz: 0, depth: 0, kind: "tree" };
  private n = new THREE.Vector3();
  onImpact?: (e: ImpactEvent) => void;

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  place(x: number, z: number, heading: number, world: PhysicsWorld) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vy = this.r = 0;
    this.gear = 1;
    this.rpm = IDLE;
    this.inWater = 0;
    this.y = world.heightAt(x, z);
  }

  step(dt: number, c: Controls, world: PhysicsWorld) {
    const surf = world.surfaceAt(this.x, this.z);
    this.surface = surf;
    const mu = surf.mu;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const fx = -sinH;
    const fz = -cosH; // forward
    const lx = -cosH;
    const lz = sinH; // left

    // ── steering: speed-sensitive lock ──
    const maxSteer = 0.54 / (1 + Math.max(0, this.vx) / 21);
    this.steerAngle = c.steer * maxSteer;
    const delta = this.steerAngle;

    // ── driver intent → drive / brake ──
    let drive = 0;
    let brake = 0;
    if (this.vx > 0.6) {
      drive = c.throttle;
      brake = c.brake;
      if (this.gear < 1) this.gear = 1;
    } else if (this.vx < -0.6) {
      drive = c.brake;
      brake = c.throttle;
      this.gear = -1;
    } else if (c.throttle > 0.05) {
      if (this.gear < 1) this.gear = 1;
      drive = c.throttle;
    } else if (c.brake > 0.05) {
      this.gear = -1;
      drive = c.brake;
    }

    // ── gearbox ──
    const ratio = this.gear < 0 ? REVERSE : GEARS[this.gear - 1];
    const wheelRpm = (Math.abs(this.vx) / WHEEL_R) * (60 / (2 * Math.PI));
    let rpm = wheelRpm * ratio * FINAL;
    // clutch slip at launch: let revs rise with throttle
    const launch = IDLE + drive * 3600 * (1 - smoothstep(4, 12, Math.abs(this.vx)));
    rpm = Math.max(rpm, launch, IDLE);
    // spinning rear tyres drag the revs up with them
    const effRpm = Math.min(rpm + this.wheelspin * 2400, REDLINE + 150);
    if (this.gear > 1 && Math.abs(this.vx) < 3) this.gear = 1; // pulled away from a stop
    if (this.gear > 0 && this.shiftTimer <= 0) {
      // short-shift when cruising, rev out under full throttle
      const upAt = drive > 0.85 ? 8350 : drive > 0.3 ? 6400 : 5000;
      if (effRpm > upAt && this.gear < GEARS.length && this.vx > 3) {
        this.gear++;
        this.shiftTimer = 0.22;
      } else if (this.gear > 1) {
        const lowerRpm = wheelRpm * GEARS[this.gear - 2] * FINAL;
        const downAt = brake > 0.3 ? 4600 : drive > 0.85 ? 5200 : 2600;
        if (lowerRpm < 7600 && rpm < downAt) {
          this.gear--;
          this.shiftTimer = 0.18;
        }
      }
    }
    this.shiftTimer -= dt;
    this.rpm = lerp(this.rpm, effRpm, 1 - Math.exp(-dt * 18));

    // ── loads ──
    const fzFront = Math.max(0, MASS * G * (CG_R / WB) - (MASS * this.ax * CG_H) / WB);
    const fzRear = Math.max(0, MASS * G * (CG_F / WB) + (MASS * this.ax * CG_H) / WB);

    // ── longitudinal forces ──
    let fDrive = 0;
    if (drive > 0 && this.shiftTimer <= 0 && effRpm < REDLINE) {
      fDrive = (torqueAt(this.rpm) * drive * ratio * FINAL * 0.86) / WHEEL_R;
      if (this.gear < 0) {
        fDrive = -fDrive * 0.45;
        if (this.vx < -11) fDrive = 0;
      }
    }
    const traction = mu * fzRear;
    // traction control (part of the assist): never ask for more than the tyres can give
    if (this.assist && !c.handbrake) fDrive = clamp(fDrive, -traction * 0.98, traction * 0.98);
    this.wheelspin = lerp(this.wheelspin, clamp((Math.abs(fDrive) - traction) / (traction + 1), 0, 1), 1 - Math.exp(-dt * 8));
    fDrive = clamp(fDrive, -traction, traction);

    let fBrake = 0;
    if (brake > 0) fBrake = -Math.sign(this.vx) * brake * Math.min(BRAKE_FORCE, mu * (fzFront + fzRear));
    let rearLong = fDrive;
    if (c.handbrake) {
      const lock = -Math.sign(this.vx) * mu * fzRear * 0.85;
      rearLong = Math.abs(this.vx) > 0.3 ? lock : 0;
      fDrive = 0;
    }
    const v = Math.hypot(this.vx, this.vy);
    const fDrag = -DRAG * this.vx * v - surf.drag * MASS * this.vx;
    const fRoll = -Math.sign(this.vx) * surf.roll * MASS * G * Math.min(1, Math.abs(this.vx));
    // engine braking off throttle
    const fEngine = drive === 0 && this.gear > 0 && this.vx > 1 ? -(this.rpm / 9000) * 110 * ratio * FINAL / WHEEL_R : 0;

    // ── slope ──
    const n = world.normalAt(this.x, this.z, this.n);
    const gx = G * n.y * n.x;
    const gz = G * n.y * n.z;
    const gFwd = gx * fx + gz * fz;
    const gLat = gx * lx + gz * lz;

    // ── lateral tyre forces ──
    let fyF = 0;
    let fyR = 0;
    const forward = this.vx > 0.2;
    if (forward) {
      const vxa = Math.max(this.vx, 1.2);
      const alphaF = delta - Math.atan((this.vy + CG_F * this.r) / vxa);
      const alphaR = -Math.atan((this.vy - CG_R * this.r) / vxa);
      const maxF = mu * fzFront;
      let maxR = Math.sqrt(Math.max(0, (mu * fzRear) ** 2 - rearLong * rearLong));
      if (c.handbrake) maxR *= 0.32;
      maxR *= 1 - this.wheelspin * 0.55;
      fyF = maxF * Math.tanh((C_F * alphaF) / (maxF + 1));
      fyR = maxR * Math.tanh((C_R * alphaR) / (maxR + 1));
      this.slipFront = smoothstep(0.1, 0.3, Math.abs(alphaF));
      this.slipRear = Math.max(smoothstep(0.1, 0.28, Math.abs(alphaR)), this.wheelspin, c.handbrake && v > 3 ? 1 : 0);
    } else {
      this.slipFront = 0;
      this.slipRear = this.wheelspin;
    }
    if (brake > 0.85 && Math.abs(this.vx) > 8 && mu * (fzFront + fzRear) < BRAKE_FORCE * 1.05) {
      this.slipFront = Math.max(this.slipFront, 0.6);
    }

    // ── integrate ──
    const fLong = rearLong + fBrake + fDrag + fRoll + (c.handbrake ? 0 : fEngine);
    let axN = (fLong - fyF * Math.sin(delta)) / MASS + gFwd + this.vy * this.r;
    let ayN = (fyR + fyF * Math.cos(delta)) / MASS + gLat - this.vx * this.r;
    const rDot = (CG_F * fyF * Math.cos(delta) - CG_R * fyR) / IZ;

    // parking hold on gentle slopes so the car doesn't creep
    if (drive === 0 && Math.abs(this.vx) < 0.4 && Math.abs(gFwd) < 2.6 && !c.handbrake) {
      axN = -this.vx / dt;
    }
    // brakes can't push the car backwards
    const prevVx = this.vx;
    this.vx += axN * dt;
    if (brake > 0 && Math.sign(prevVx) !== Math.sign(this.vx) && Math.abs(prevVx) < 2) this.vx = 0;
    if (c.handbrake && Math.abs(this.vx) < 0.5) this.vx = 0;
    this.vy += ayN * dt;
    this.r += rDot * dt;

    // low speed / reverse: blend to kinematic steering (the tyre model is singular near 0)
    const k = forward ? smoothstep(1.5, 5.5, this.vx) : 0;
    const rKin = (this.vx * Math.tan(delta)) / WB;
    this.r = lerp(rKin, this.r, k);
    this.vy = lerp(this.vy * Math.exp(-dt * 10), this.vy, k);

    // stability assist: tame oversteer unless the player is deliberately drifting
    if (this.assist && !c.handbrake && forward) {
      const rIdeal = clamp(rKin, -(mu * G) / Math.max(this.vx, 1), (mu * G) / Math.max(this.vx, 1));
      const excess = this.r - rIdeal;
      if (Math.sign(excess) === Math.sign(this.r) && Math.abs(excess) > 0.08) {
        this.r -= excess * (1 - Math.exp(-dt * 3.2));
      }
      this.vy *= Math.exp(-dt * 0.9);
    }
    this.r = clamp(this.r, -3.2, 3.2);

    // water: heavy drag, then the car stalls
    if (surf.kind === "water") {
      this.vx *= Math.exp(-dt * 1.6);
      this.vy *= Math.exp(-dt * 2.5);
      this.inWater += dt;
    } else this.inWater = 0;

    this.ax = lerp(this.ax, axN - this.vy * this.r - gFwd, 1 - Math.exp(-dt * 6));
    this.ay = lerp(this.ay, ayN + this.vx * this.r - gLat, 1 - Math.exp(-dt * 6));

    this.heading += this.r * dt;
    const sH = Math.sin(this.heading);
    const cH = Math.cos(this.heading);
    const nfx = -sH;
    const nfz = -cH;
    const nlx = -cH;
    const nlz = sH;
    let vwx = this.vx * nfx + this.vy * nlx;
    let vwz = this.vx * nfz + this.vy * nlz;
    this.x += vwx * dt;
    this.z += vwz * dt;

    // ── collisions (two circles along the body) ──
    for (const off of [1.3, -1.25]) {
      const cx = this.x + nfx * off;
      const cz = this.z + nfz * off;
      if (!world.colliders.query(cx, cz, 0.98, this.contact)) continue;
      const ct = this.contact;
      this.x += ct.nx * ct.depth;
      this.z += ct.nz * ct.depth;
      const vn = vwx * ct.nx + vwz * ct.nz;
      if (vn < 0) {
        const e = 0.22;
        const jx = -(1 + e) * vn * ct.nx;
        const jz = -(1 + e) * vn * ct.nz;
        vwx += jx;
        vwz += jz;
        vwx *= 0.9;
        vwz *= 0.9;
        // spin from an off-centre hit
        const rx = nfx * off - ct.nx * 0.98;
        const rz = nfz * off - ct.nz * 0.98;
        this.r += ((rz * jx - rx * jz) * MASS * 0.45) / IZ;
        if (-vn > 1.2) this.onImpact?.({ speed: -vn, kind: ct.kind });
      }
    }
    // soft boundary at the edge of the valley
    const dist = Math.hypot(this.x, this.z);
    if (dist > world.limit) {
      const nx = -this.x / dist;
      const nz = -this.z / dist;
      this.x += nx * (dist - world.limit);
      this.z += nz * (dist - world.limit);
      const vn = vwx * nx + vwz * nz;
      if (vn < 0) {
        vwx -= 1.3 * vn * nx;
        vwz -= 1.3 * vn * nz;
        if (-vn > 1.2) this.onImpact?.({ speed: -vn, kind: "boundary" });
      }
    }
    this.vx = vwx * nfx + vwz * nfz;
    this.vy = vwx * nlx + vwz * nlz;

    // ── ground pose from four wheel contacts ──
    const hw = 0.83;
    const hFL = world.heightAt(this.x + nfx * 1.2 + nlx * hw, this.z + nfz * 1.2 + nlz * hw);
    const hFR = world.heightAt(this.x + nfx * 1.2 - nlx * hw, this.z + nfz * 1.2 - nlz * hw);
    const hRL = world.heightAt(this.x - nfx * 1.4 + nlx * hw, this.z - nfz * 1.4 + nlz * hw);
    const hRR = world.heightAt(this.x - nfx * 1.4 - nlx * hw, this.z - nfz * 1.4 - nlz * hw);
    const yGround = (hFL + hFR + hRL + hRR) / 4;
    this.y = yGround;
    this.pitch = Math.atan2((hFL + hFR) / 2 - (hRL + hRR) / 2, 2.6);
    this.roll = Math.atan2((hFL + hRL) / 2 - (hFR + hRR) / 2, 2 * hw);

    // wheel rotation for visuals
    this.frontSpin += (this.vx / WHEEL_R) * dt;
    const rearSurface = c.handbrake && Math.abs(this.vx) > 0.5 ? 0 : this.vx / WHEEL_R;
    this.rearSpin += (rearSurface + Math.sign(drive) * this.wheelspin * 60) * dt;
    this.throttleOut = drive;
  }
}
