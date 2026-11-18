import { Ray, Scene, Vector3, type AbstractMesh, type TransformNode } from '@babylonjs/core';
import type { WalkGrid } from './collision';

const SKIP_RAY =
  /char:|\/player|sky|tuft|bang|shadow|hem|sleeve|robe|head|iris|brow|eye|bangDot|pave-|paving|carpet|hall-floor|ql-land|ql-sea|ql-beach|ql-farm|flagstone|cobble|verge/i;

export type DumpOpts = {
  points?: Array<[number, number, string]>;
  grid?: WalkGrid;
  regions?: Array<{ x0: number; x1: number; z0: number; z1: number; step: number; tag: string }>;
};

function aabbOf(m: AbstractMesh) {
  const bb = m.getBoundingInfo().boundingBox;
  const min = bb.minimumWorld;
  const max = bb.maximumWorld;
  return {
    name: m.name,
    parent: m.parent?.name ?? '',
    label: `${m.name} ${m.parent?.name ?? ''}`,
    visible: m.isVisible,
    vis: m.visibility ?? 1,
    minX: +min.x.toFixed(3),
    maxX: +max.x.toFixed(3),
    minY: +min.y.toFixed(3),
    maxY: +max.y.toFixed(3),
    minZ: +min.z.toFixed(3),
    maxZ: +max.z.toFixed(3),
    ex: +(max.x - min.x).toFixed(3),
    ey: +(max.y - min.y).toFixed(3),
    ez: +(max.z - min.z).toFixed(3)
  };
}

function raycastDown(scene: Scene, x: number, z: number, yFrom = 14) {
  const ray = new Ray(new Vector3(x, yFrom, z), new Vector3(0, -1, 0), yFrom + 6);
  let best: { name: string; parent: string; y: number; distance: number } | null = null;
  for (const mesh of scene.meshes) {
    if (!mesh.isEnabled() || !mesh.isVisible) continue;
    const label = `${mesh.name} ${mesh.parent?.name ?? ''}`;
    if (SKIP_RAY.test(label)) continue;
    try {
      const hit = mesh.intersects(ray, true);
      if (hit && hit.hit && hit.distance < (best?.distance ?? 1e9)) {
        best = {
          name: mesh.name,
          parent: mesh.parent?.name ?? '',
          y: +(yFrom - hit.distance).toFixed(3),
          distance: +hit.distance.toFixed(3)
        };
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

export function dumpWalkScene(scene: Scene, opts: DumpOpts = {}) {
  const INTEREST =
    /water|pond|lotus|bridge|stair|step|terrace|throne|lion|hall|palace|pave|coping|edge|well|pavilion|moon|gate|walkway|dais|pier|dock|plank|coast|platform|aisle|peony|char:|player|kangxi|yongzheng|qianlong|manchu|han|official|heshen|farmer|soldier|flagstone|cobble|ground|floor|wall|ceremonial|sea|land|beach|flagship|barge|ship|rockery|bamboo|stool|column/i;

  const meshes = [];
  for (const m of scene.meshes) {
    if (!m.isEnabled()) continue;
    try {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo(false, false);
    } catch {
      /* ok */
    }
    let rec;
    try {
      rec = aabbOf(m);
    } catch {
      continue;
    }
    if (INTEREST.test(rec.label) || (rec.ey > 0.25 && rec.ex * rec.ez > 6)) meshes.push(rec);
  }

  const nodes: Array<Record<string, unknown>> = [];
  for (const n of scene.transformNodes) {
    const name = n.name || '';
    if (!INTEREST.test(name)) continue;
    try {
      n.computeWorldMatrix(true);
      const p = n.getAbsolutePosition();
      nodes.push({
        name,
        parent: (n.parent as TransformNode | null)?.name ?? '',
        x: +p.x.toFixed(3),
        y: +p.y.toFixed(3),
        z: +p.z.toFixed(3),
        rotY: n.rotation ? +n.rotation.y.toFixed(3) : null,
        sx: n.scaling ? +n.scaling.x.toFixed(3) : null
      });
    } catch {
      /* ok */
    }
  }

  const chars: Array<Record<string, unknown>> = [];
  for (const n of scene.transformNodes) {
    const name = n.name || '';
    if (!/^char:/.test(name)) continue;
    if (n.parent && /^char:/.test((n.parent as TransformNode).name || '')) continue;
    try {
      n.computeWorldMatrix(true);
      const p = n.getAbsolutePosition();
      let minY = Infinity,
        maxY = -Infinity,
        minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const m of n.getChildMeshes(false)) {
        try {
          m.computeWorldMatrix(true);
          m.refreshBoundingInfo(false, false);
          const bb = m.getBoundingInfo().boundingBox;
          minY = Math.min(minY, bb.minimumWorld.y);
          maxY = Math.max(maxY, bb.maximumWorld.y);
          minX = Math.min(minX, bb.minimumWorld.x);
          maxX = Math.max(maxX, bb.maximumWorld.x);
          minZ = Math.min(minZ, bb.minimumWorld.z);
          maxZ = Math.max(maxZ, bb.maximumWorld.z);
        } catch {
          /* ok */
        }
      }
      chars.push({
        name,
        root: { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) },
        footMinY: Number.isFinite(minY) ? +minY.toFixed(3) : null,
        headMaxY: Number.isFinite(maxY) ? +maxY.toFixed(3) : null,
        footOffset: Number.isFinite(minY) ? +(minY - p.y).toFixed(3) : null,
        aabb: Number.isFinite(minY)
          ? {
              minX: +minX.toFixed(3),
              maxX: +maxX.toFixed(3),
              minY: +minY.toFixed(3),
              maxY: +maxY.toFixed(3),
              minZ: +minZ.toFixed(3),
              maxZ: +maxZ.toFixed(3)
            }
          : null
      });
    } catch {
      /* ok */
    }
  }

  const pts: Array<[number, number, string]> = [...(opts.points ?? [])];
  for (const r of opts.regions ?? []) {
    for (let x = r.x0; x <= r.x1 + 1e-9; x += r.step) {
      for (let z = r.z0; z <= r.z1 + 1e-9; z += r.step) {
        pts.push([+x.toFixed(2), +z.toFixed(2), r.tag]);
      }
    }
  }

  const heights = pts.map(([x, z, tag]) => {
    const hit = raycastDown(scene, x, z);
    const gridY = opts.grid ? +opts.grid.heightAt(x, z, 0.32).toFixed(3) : null;
    const gridY0 = opts.grid ? +opts.grid.heightAt(x, z, 0).toFixed(3) : null;
    const resolved = opts.grid ? opts.grid.resolve(x, z) : null;
    const push = resolved ? +Math.hypot(resolved.x - x, resolved.z - z).toFixed(3) : null;
    return { x, z, tag, hit, gridY, gridY0, push, res: resolved };
  });

  return {
    meshCount: scene.meshes.length,
    meshes,
    nodes,
    chars,
    heights
  };
}
