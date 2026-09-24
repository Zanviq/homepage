import * as THREE from "three";
import { naturalHeight } from "./landform";

export { DRIVE_LIMIT, LAKE, LANE_OFFSET, ROAD_HALF, WATER_LEVEL, WORLD_HALF } from "./constants";

// The circuit: a closed loop through the valley. Coordinates are metres on
// the ground plane (x, z). Elevation follows the smoothed natural terrain so
// the road sits in the landscape instead of on stilts or in trenches. The
// start line is at the first point and the loop runs in list order.
const CONTROL: [number, number, number][] = [
  [-280, 340, 1.0],
  [-282, 90, 0.6],
  [-262, -160, 1.5],
  [-170, -360, 4.5],
  [20, -480, 10],
  [200, -440, 15.5],
  [285, -290, 18],
  [205, -140, 14.5],
  [80, -118, 10],
  [22, 2, 6.5],
  [100, 140, 4.5],
  [240, 235, 6],
  [228, 400, 5],
  [60, 482, 2.4],
  [-120, 498, 2.0],
  [-228, 440, 1.4],
];


const STEP = 1.5; // metres between road samples
const CELL = 24;

export interface RoadHit {
  i: number; // sample index
  s: number; // arc length
  dist: number; // horizontal distance to the centre line
  lateral: number; // signed offset, + = left of travel direction
  y: number; // road elevation at the sample
}

export class Track {
  readonly length: number;
  readonly count: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly tx: Float32Array; // unit tangent (xz)
  readonly tz: Float32Array;
  readonly curvature: Float32Array; // signed, + = turning left
  private grid = new Map<number, number[]>();

  constructor() {
    const pts = CONTROL.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    curve.arcLengthDivisions = 4000;
    this.length = curve.getLength();
    this.count = Math.floor(this.length / STEP);
    const n = this.count;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.tz = new Float32Array(n);
    this.curvature = new Float32Array(n);

    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      curve.getPointAt(i / n, p);
      this.px[i] = p.x;
      this.py[i] = p.y;
      this.pz[i] = p.z;
    }
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n;
      const b = (i + 1) % n;
      const dx = this.px[b] - this.px[a];
      const dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l;
      this.tz[i] = dz / l;
    }
    // Curvature from the heading change over ±6 samples, smoothed.
    for (let i = 0; i < n; i++) {
      const a = (i - 6 + n) % n;
      const b = (i + 6) % n;
      const cross = this.tx[a] * this.tz[b] - this.tz[a] * this.tx[b];
      // With y up and z toward the viewer, a positive cross (a -> b) is a
      // clockwise turn seen from above, i.e. a right turn; flip for "+ = left".
      this.curvature[i] = -cross / (12 * STEP);
    }
    // Elevation: the land under the road, heavily smoothed (±45 m windows,
    // several passes) so grades stay gentle, and kept above the lake.
    for (let i = 0; i < n; i++) this.py[i] = naturalHeight(this.px[i], this.pz[i]);
    const y2 = new Float32Array(n);
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -30; k <= 30; k++) sum += this.py[(i + k + n) % n];
        y2[i] = Math.max(sum / 61, 2.2);
      }
      this.py.set(y2);
    }
    for (let i = 0; i < n; i++) {
      const key = this.key(this.px[i], this.pz[i]);
      const list = this.grid.get(key);
      if (list) list.push(i);
      else this.grid.set(key, [i]);
    }
  }

  private key(x: number, z: number): number {
    const cx = Math.floor(x / CELL) + 512;
    const cz = Math.floor(z / CELL) + 512;
    return cx * 4096 + cz;
  }

  sOf(i: number): number {
    return (i / this.count) * this.length;
  }

  indexAt(s: number): number {
    const n = this.count;
    return ((Math.round((s / this.length) * n) % n) + n) % n;
  }

  /** Left-pointing unit normal at sample i. */
  leftX(i: number) {
    return this.tz[i];
  }
  leftZ(i: number) {
    return -this.tx[i];
  }

  nearest(x: number, z: number, out?: RoadHit): RoadHit {
    const hit = out ?? { i: 0, s: 0, dist: Infinity, lateral: 0, y: 0 };
    let best = -1;
    let bestD = Infinity;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let ring = 1; ring <= 4 && best < 0; ring++) {
      for (let gx = cx - ring; gx <= cx + ring; gx++) {
        for (let gz = cz - ring; gz <= cz + ring; gz++) {
          const list = this.grid.get((gx + 512) * 4096 + (gz + 512));
          if (!list) continue;
          for (const i of list) {
            const dx = x - this.px[i];
            const dz = z - this.pz[i];
            const d = dx * dx + dz * dz;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
        }
      }
    }
    if (best < 0) {
      for (let i = 0; i < this.count; i += 2) {
        const dx = x - this.px[i];
        const dz = z - this.pz[i];
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    const dx = x - this.px[best];
    const dz = z - this.pz[best];
    const lateral = dx * this.leftX(best) + dz * this.leftZ(best);
    const along = dx * this.tx[best] + dz * this.tz[best];
    hit.i = best;
    hit.s = this.sOf(best) + along;
    hit.dist = Math.abs(lateral);
    hit.lateral = lateral;
    hit.y = this.py[best];
    return hit;
  }

  /** Heading (car yaw) that points along the road at sample i. */
  headingAt(i: number): number {
    return Math.atan2(-this.tx[i], -this.tz[i]);
  }
}
