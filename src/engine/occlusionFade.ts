import { AbstractMesh, Ray, Scene, Vector3 } from '@babylonjs/core';

const FADED = 0.34;
const FADE_RATE = 10; // ~0.2s ease
const MIN_EXTENT = 0.9;
const MAX_GROUND_THICKNESS = 0.4;
const MAX_GROUND_AREA = 16;

const SKIP =
  /char:|\/player|paving|pave-|floor|ground|verge|tuft|sky|sea|ql-land|ql-sea|ql-beach|ql-farm|ql-battle|flagstone|cobble|carpet|hall-floor|hem|sleeve|robe|head|iris|brow|eye|pond-water|lotus-cluster|water-module/i;
const FADE =
  /wall|hall|gate|roof|column|pavilion|walkway|finial|balustrade|tower|lattice|screen|cabin|mast|sail|flagship|ceremonial|palace|moon-gate|meshy-pavilion|meshy-moon|pier|dock|bridge/i;

/**
 * Fade architecture that sits between the camera eye and the player's body
 * so the character stays visible. Uses mesh.visibility (not a shared material).
 * Coarse AABB filter, then a triangle pick — AABB-only rays false-hit huge
 * combined boxes (walkway, hall, palace, paving, bridge).
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
          let min: Vector3;
          let max: Vector3;
          try {
            const bb = mesh.getBoundingInfo().boundingBox;
            min = bb.minimumWorld;
            max = bb.maximumWorld;
          } catch {
            continue;
          }
          const ex = max.x - min.x;
          const ey = max.y - min.y;
          const ez = max.z - min.z;
          const extent = Math.hypot(ex, ey, ez);
          if (extent < MIN_EXTENT) continue;
          // Thin, wide planes are ground / paving overlays, not occluders.
          if (ey < MAX_GROUND_THICKNESS && ex * ez > MAX_GROUND_AREA) continue;
          if (!FADE.test(label) && extent < 2.4) continue;
          const inside =
            cam.x >= min.x && cam.x <= max.x &&
            cam.y >= min.y && cam.y <= max.y &&
            cam.z >= min.z && cam.z <= max.z;
          if (!inside && !ray.intersectsBoxMinMax(min, max)) continue;
          // Precise: ray.intersectsMesh first puts the eye→chest ray into the
          // mesh's local space. mesh.intersects() expects a local ray, so a
          // world-space call almost never hits placed architecture.
          // If the eye is already inside a reasonably sized piece (a column
          // the camera clipped into), a local ray can miss backfaces — fade
          // those only. Skip courtyard-sized combined boxes on the inside path.
          try {
            const hit = ray.intersectsMesh(mesh, true);
            if (hit && hit.hit) {
              hits.add(mesh);
              continue;
            }
          } catch {
            /* unpickable / frozen geometry */
          }
          if (inside && extent <= 18 && FADE.test(label)) hits.add(mesh);
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
