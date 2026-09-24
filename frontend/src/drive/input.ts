import { clamp } from "./noise";
import type { Controls } from "./physics";

export type Action = "camera" | "reset" | "interact" | "sound" | "map" | "pause" | "time" | "lights";

const KEY_ACTIONS: Record<string, Action> = {
  KeyC: "camera",
  KeyR: "reset",
  KeyE: "interact",
  Enter: "interact",
  KeyM: "sound",
  Tab: "map",
  KeyJ: "map",
  Escape: "pause",
  KeyP: "pause",
  KeyT: "time",
  KeyL: "lights",
};

export interface TouchState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

/** Keyboard + gamepad + on-screen touch, merged into smoothed car controls. */
export class Input {
  private keys = new Set<string>();
  readonly touch: TouchState = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  readonly controls: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  enabled = true;
  onAction?: (a: Action) => void;
  private padButtons: boolean[] = [];

  private down = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const action = KEY_ACTIONS[e.code];
    if (action) {
      e.preventDefault();
      if (!e.repeat) this.onAction?.(action);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private blur = () => this.keys.clear();

  attach() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
  }

  detach() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
  }

  update(dt: number, speed: number) {
    const k = this.keys;
    let throttle = k.has("KeyW") || k.has("ArrowUp") ? 1 : 0;
    let brake = k.has("KeyS") || k.has("ArrowDown") ? 1 : 0;
    let steer = (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0);
    let handbrake = k.has("Space");
    let analogSteer = false;

    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      const sx = pad.axes[0] ?? 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (Math.abs(sx) > 0.12) {
        steer = -Math.sign(sx) * ((Math.abs(sx) - 0.12) / 0.88) ** 1.4;
        analogSteer = true;
      }
      if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) handbrake = true;
      const map: [number, Action][] = [
        [3, "camera"],
        [2, "interact"],
        [9, "pause"],
        [8, "map"],
        [12, "reset"],
      ];
      for (const [b, a] of map) {
        const pressed = !!pad.buttons[b]?.pressed;
        if (pressed && !this.padButtons[b]) this.onAction?.(a);
        this.padButtons[b] = pressed;
      }
    }

    const t = this.touch;
    if (t.throttle > 0) throttle = Math.max(throttle, t.throttle);
    if (t.brake > 0) brake = Math.max(brake, t.brake);
    if (Math.abs(t.steer) > 0.01) {
      steer = t.steer;
      analogSteer = true;
    }
    if (t.handbrake) handbrake = true;

    if (!this.enabled) {
      throttle = 0;
      brake = speed > 1 ? 0.6 : 0;
      steer = 0;
      handbrake = false;
    }

    const c = this.controls;
    // digital keys ramp in; release returns faster (like a real rack)
    if (analogSteer) c.steer = steer;
    else {
      const rate = steer === 0 ? 6 : Math.sign(steer) !== Math.sign(c.steer) && c.steer !== 0 ? 9 : 3.2;
      c.steer += clamp(steer - c.steer, -rate * dt, rate * dt);
    }
    c.throttle += clamp(throttle - c.throttle, -8 * dt, 5 * dt);
    c.brake += clamp(brake - c.brake, -10 * dt, 7 * dt);
    c.handbrake = handbrake;
    return c;
  }
}
