// Static 2D colliders on the ground plane: circles (trunks, poles, rocks)
// and segments (guardrails, sign legs), bucketed in a spatial hash.

export type ColliderKind = "tree" | "pole" | "rock" | "rail" | "sign" | "building";

interface Circle {
  type: 0;
  x: number;
  z: number;
  r: number;
  kind: ColliderKind;
}
interface Segment {
  type: 1;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  kind: ColliderKind;
}
type Shape = Circle | Segment;

export interface Contact {
  nx: number; // push-out normal
  nz: number;
  depth: number;
  kind: ColliderKind;
}

const CELL = 16;

export class Colliders {
  private cells = new Map<number, Shape[]>();
  count = 0;

  private key(cx: number, cz: number) {
    return (cx + 1024) * 4096 + (cz + 1024);
  }

  private insert(shape: Shape, x0: number, z0: number, x1: number, z1: number) {
    const cx0 = Math.floor(x0 / CELL);
    const cz0 = Math.floor(z0 / CELL);
    const cx1 = Math.floor(x1 / CELL);
    const cz1 = Math.floor(z1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = this.key(cx, cz);
        const list = this.cells.get(k);
        if (list) list.push(shape);
        else this.cells.set(k, [shape]);
      }
    }
    this.count++;
  }

  addCircle(x: number, z: number, r: number, kind: ColliderKind) {
    this.insert({ type: 0, x, z, r, kind }, x - r, z - r, x + r, z + r);
  }

  addSegment(ax: number, az: number, bx: number, bz: number, kind: ColliderKind) {
    this.insert(
      { type: 1, ax, az, bx, bz, kind },
      Math.min(ax, bx),
      Math.min(az, bz),
      Math.max(ax, bx),
      Math.max(az, bz),
    );
  }

  /** Deepest contact between a circle (x, z, r) and the world, if any. */
  query(x: number, z: number, r: number, out: Contact): boolean {
    let found = false;
    out.depth = 0;
    const cx0 = Math.floor((x - r) / CELL);
    const cz0 = Math.floor((z - r) / CELL);
    const cx1 = Math.floor((x + r) / CELL);
    const cz1 = Math.floor((z + r) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const s of list) {
          let px: number;
          let pz: number;
          let rr = r;
          if (s.type === 0) {
            px = s.x;
            pz = s.z;
            rr += s.r;
          } else {
            const sx = s.bx - s.ax;
            const sz = s.bz - s.az;
            const l = sx * sx + sz * sz || 1;
            let u = ((x - s.ax) * sx + (z - s.az) * sz) / l;
            u = u < 0 ? 0 : u > 1 ? 1 : u;
            px = s.ax + sx * u;
            pz = s.az + sz * u;
            rr += 0.12;
          }
          const dx = x - px;
          const dz = z - pz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 1e-4;
          const depth = rr - d;
          if (depth > out.depth) {
            out.depth = depth;
            out.nx = dx / d;
            out.nz = dz / d;
            out.kind = s.kind;
            found = true;
          }
        }
      }
    }
    return found;
  }
}
