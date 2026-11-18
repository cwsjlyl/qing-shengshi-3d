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

  heightAt(x: number, z: number): number {
    let y = 0;
    for (const p of this.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        if (p.y > y) y = p.y;
      }
    }
    for (const r of this.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const span = r.axis === 'x' ? r.maxX - r.minX : r.maxZ - r.minZ;
        const t0 = r.axis === 'x' ? (x - r.minX) / span : (z - r.minZ) / span;
        const t = r.fromMin ? t0 : 1 - t0;
        const hy = r.y0 + (r.y1 - r.y0) * Math.min(1, Math.max(0, t));
        if (hy > y) y = hy;
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
