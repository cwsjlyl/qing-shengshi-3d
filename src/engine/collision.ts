export type Aabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
};

export type Platform = Aabb & { y: number };

export type Ramp = Aabb & { y0: number; y1: number; axis: 'x' | 'z'; fromMin: boolean };

export class WalkGrid {
  solids: Aabb[] = [];
  cameraSolids: Aabb[] = [];
  platforms: Platform[] = [];
  ramps: Ramp[] = [];
  radius: number;

  constructor(radius = 0.4) {
    this.radius = radius;
  }

  addSolid(minX: number, maxX: number, minZ: number, maxZ: number, minY = 0, maxY = 3.4): void {
    this.solids.push({ minX, maxX, minZ, maxZ, minY, maxY });
    this.cameraSolids.push({ minX, maxX, minZ, maxZ, minY, maxY });
  }

  addCameraSolid(minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number): void {
    this.cameraSolids.push({ minX, maxX, minZ, maxZ, minY, maxY });
  }

  /** True if a point is inside a solid volume (used to keep the camera out of walls/roofs). */
  hitsCamera(x: number, y: number, z: number): boolean {
    for (const s of this.cameraSolids) {
      const y0 = s.minY ?? 0;
      const y1 = s.maxY ?? 3.4;
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && y >= y0 && y <= y1) {
        return true;
      }
    }
    return false;
  }

  firstOpenOffset(
    x: number,
    z: number,
    candidates: Array<[number, number]>
  ): { x: number; z: number } | null {
    for (const [dx, dz] of candidates) {
      const nx = x + dx;
      const nz = z + dz;
      const r = this.resolve(nx, nz);
      if (Math.hypot(r.x - nx, r.z - nz) < 0.25) return r;
    }
    return this.resolve(x, z);
  }

  addPlatform(minX: number, maxX: number, minZ: number, maxZ: number, y: number): void {
    this.platforms.push({ minX, maxX, minZ, maxZ, y });
  }

  addRamp(r: Ramp): void {
    this.ramps.push(r);
  }

  /** Height of a single ramp at a point already known to lie inside its AABB. */
  rampHeight(r: Ramp, x: number, z: number): number {
    const span = r.axis === 'x' ? r.maxX - r.minX : r.maxZ - r.minZ;
    if (span <= 1e-8) return Math.max(r.y0, r.y1);
    const t0 = r.axis === 'x' ? (x - r.minX) / span : (z - r.minZ) / span;
    const t = r.fromMin ? t0 : 1 - t0;
    return r.y0 + (r.y1 - r.y0) * Math.min(1, Math.max(0, t));
  }

  private rampHeightIfInside(x: number, z: number): number {
    let y = 0;
    for (const r of this.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const hy = this.rampHeight(r, x, z);
        if (hy > y) y = hy;
      }
    }
    return y;
  }

  /**
   * Walk height at (x, z). Platforms use the root point only (a foot radius
   * would lift the player on courtyard ground beside a terrace — the t56 bug).
   * Ramps may also be sampled under a small foot radius so the player still
   * rises when the body is on the flight but the root is just past the end.
   * The extra samples run only along the slope axis, inside the flight width;
   * sampling sideways would lift a player walking *beside* a stair or deck.
   */
  heightAt(x: number, z: number, footR = 0): number {
    let y = 0;
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        if (p.y > y) y = p.y;
      }
    }
    y = Math.max(y, this.rampHeightIfInside(x, z));
    if (footR > 0) {
      for (const r of this.ramps) {
        if (r.axis === 'x') {
          if (z < r.minZ || z > r.maxZ) continue;
          for (const dx of [footR, -footR]) {
            const xx = x + dx;
            if (xx >= r.minX && xx <= r.maxX) {
              const hy = this.rampHeight(r, xx, z);
              if (hy > y) y = hy;
            }
          }
        } else {
          if (x < r.minX || x > r.maxX) continue;
          for (const dz of [footR, -footR]) {
            const zz = z + dz;
            if (zz >= r.minZ && zz <= r.maxZ) {
              const hy = this.rampHeight(r, x, zz);
              if (hy > y) y = hy;
            }
          }
        }
      }
    }
    return y;
  }

  resolve(x: number, z: number): { x: number; z: number } {
    const r = this.radius;
    for (const s of this.solids) {
      const cx = clamp(x, s.minX, s.maxX);
      const cz = clamp(z, s.minZ, s.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-8) {
          // Deep inside: push out along the cheapest axis.
          const left = x - s.minX + r;
          const right = s.maxX - x + r;
          const down = z - s.minZ + r;
          const up = s.maxZ - z + r;
          const m = Math.min(left, right, down, up);
          if (m === left) x = s.minX - r;
          else if (m === right) x = s.maxX + r;
          else if (m === down) z = s.minZ - r;
          else z = s.maxZ + r;
        } else {
          const d = Math.sqrt(d2);
          const k = (r - d) / d;
          x += dx * k;
          z += dz * k;
        }
      }
    }
    return { x, z };
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
