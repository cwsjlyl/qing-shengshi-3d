import { AbstractMesh, Ray, Scene, Vector3 } from '@babylonjs/core';

const FADED = 0.34;
const FADE_RATE = 10; // ~0.2s ease
const MIN_EXTENT = 0.9;

const SKIP =
  /char:|\/player|paving|floor|ground|verge|tuft|sky|sea|ql-land|ql-sea|ql-beach|ql-farm|ql-battle|flagstone|cobble|hem|sleeve|robe|head|iris|brow|eye/i;
const FADE =
  /wall|hall|gate|roof|column|pavilion|walkway|finial|balustrade|tower|lattice|screen|cabin|mast|sail|flagship|ceremonial|palace|moon-gate|meshy-pavilion|meshy-moon|pier|dock|bridge/i;

/**
 * Fade architecture that sits between the camera and the player so the
 * character stays visible. Uses mesh.visibility (not a shared material) and
 * bounding-box rays only — cheap enough for classroom iPads.
 */
export class OcclusionFader {
  private faded = new Map<AbstractMesh, number>();

  update(scene: Scene, cam: Vector3, chest: Vector3, dt: number, enabled: boolean): void {
    const hits = new Set<AbstractMesh>();
    if (enabled) {
      const to = chest.subtract(cam);
      const len = to.length();
      if (len > 0.35) {
        to.scaleInPlace(1 / len);
        const ray = new Ray(cam, to, Math.max(0.2, len - 0.2));
        for (const mesh of scene.meshes) {
          if (!mesh.isEnabled() || !mesh.isVisible || mesh.isDisposed()) continue;
          const label = `${mesh.name} ${mesh.parent?.name ?? ''}`;
          if (SKIP.test(label)) continue;
          let min = mesh.getBoundingInfo().boundingBox.minimumWorld;
          let max = mesh.getBoundingInfo().boundingBox.maximumWorld;
          const ex = max.x - min.x;
          const ey = max.y - min.y;
          const ez = max.z - min.z;
          const extent = Math.hypot(ex, ey, ez);
          if (extent < MIN_EXTENT) continue;
          if (!FADE.test(label) && extent < 2.4) continue;
          if (ray.intersectsBoxMinMax(min, max)) hits.add(mesh);
        }
      }
    }

    const seen = new Set<AbstractMesh>(hits);
    for (const m of this.faded.keys()) seen.add(m);
    const k = 1 - Math.exp(-FADE_RATE * dt);
    for (const mesh of seen) {
      if (mesh.isDisposed()) {
        this.faded.delete(mesh);
        continue;
      }
      // Talk-frame hideTalkClutter sets isVisible=false; do not fight it.
      if (!mesh.isVisible) continue;
      const cur = this.faded.get(mesh) ?? (mesh.visibility ?? 1);
      const goal = hits.has(mesh) ? FADED : 1;
      const next = cur + (goal - cur) * k;
      if (goal === 1 && next > 0.985) {
        mesh.visibility = 1;
        this.faded.delete(mesh);
      } else {
        mesh.visibility = next;
        this.faded.set(mesh, next);
      }
    }
  }

  restore(): void {
    for (const mesh of this.faded.keys()) {
      if (!mesh.isDisposed()) mesh.visibility = 1;
    }
    this.faded.clear();
  }
}
