import { Color3, PBRMaterial, Scene, Vector3 } from '@babylonjs/core';
import { freezeStatic, MODEL, placePack, type PlacedModel } from '../engine/loadModel';

async function put(
  scene: Scene,
  placed: PlacedModel[],
  url: string,
  name: string,
  x: number,
  z: number,
  rotY = 0,
  y = 0,
  scaling?: number
): Promise<PlacedModel> {
  const m = await placePack(scene, url, {
    name,
    position: new Vector3(x, y, z),
    rotationY: rotY,
    scaling
  });
  placed.push(m);
  freezeStatic(m.root);
  return m;
}

/**
 * Extra pack modules for the Kangxi courtyard: pond edges instead of green
 * slabs, hall-front balustrades, flowers, lanterns, and a little architecture.
 * Pond-edge packs dress the real east pond, south of the grey bridge.
 * Kept off walkable copings and out of the Kangxi talk corridor.
 */
export async function dressKangxiPack(scene: Scene): Promise<PlacedModel[]> {
  const placed: PlacedModel[] = [];

  // Stone pond edges on the real east pond only (water X[0,8] Z[0,8]).
  // Modules are ~4 m along local X; yaw puts that axis along the lip.
  // Planted side (local -Z) points into the water, and the mesh sits just
  // inside the water so the walkable 汉白玉 copings stay clear. Only the
  // south half is dressed — a module at z=6 would intersect the grey bridge
  // (Z[5.10, 8.10]). South lip uses the two leftover modules.
  await put(scene, placed, MODEL.pondEdge, 'kx-edge-pond-w', 0.2, 2, Math.PI / 2, -0.6);
  await put(scene, placed, MODEL.pondEdge, 'kx-edge-pond-e', 7.8, 2, -Math.PI / 2, -0.6);
  await put(scene, placed, MODEL.pondEdge, 'kx-edge-pond-s-a', 2, 0.2, Math.PI, -0.6);
  await put(scene, placed, MODEL.pondEdge, 'kx-edge-pond-s-b', 6, 0.2, Math.PI, -0.6);

  // Hall-front stone balustrade covers the pale hall terrace rail, with a stair gap in the centre.
  // Hall is at (0,0,-8); stone front is at z ≈ -1.1, platform top ≈ 1.1, module length 4.26.
  await put(scene, placed, MODEL.balustrade, 'kx-rail-fl', -4.85, -1.18, 0, 1.1, 1.12);
  await put(scene, placed, MODEL.balustrade, 'kx-rail-fr', 4.85, -1.18, 0, 1.1, 1.12);
  await put(scene, placed, MODEL.balustrade, 'kx-rail-sl', -7.45, -3.4, Math.PI / 2, 1.1);
  await put(scene, placed, MODEL.balustrade, 'kx-rail-sr', 7.45, -3.4, Math.PI / 2, 1.1);

  // Pack stepping-stone path modules used to run along this aisle (z≈-4..3.2).
  // They are taller (~0.23) than the Meshy flagstone slabs (~0.08) and would
  // poke through or double-layer, so the aisle is now dressed with Meshy flags.

  // Peony planters for path-side flower density — off the walkway and talk corridor.
  const peonies: Array<[string, number, number, number]> = [
    ['kx-peony-1', -5.7, -2.8, 0],
    ['kx-peony-2', 3.9, -2.6, 0.2],
    ['kx-peony-3', -5.9, -5.2, -0.15],
    ['kx-peony-4', 4.3, -5.0, 0.3],
    ['kx-peony-5', 3.2, 9.0, 0],
    ['kx-peony-6', 8.6, -1.4, 0.4],
    ['kx-peony-7', -10.0, 6.2, 0.2]
  ];
  for (const [name, x, z, rot] of peonies) {
    await put(scene, placed, MODEL.peony, name, x, z, rot, 0);
  }

  // Floating lanterns on the real east pond, south of the grey bridge.
  await put(scene, placed, MODEL.waterLantern, 'kx-wlan-1', 1.8, 2.2, 0.4, -0.24);
  await put(scene, placed, MODEL.waterLantern, 'kx-wlan-2', 2.6, 4.0, -0.6, -0.24);
  await put(scene, placed, MODEL.waterLantern, 'kx-wlan-3', 5.4, 1.8, 1.1, -0.24);
  await put(scene, placed, MODEL.waterLantern, 'kx-wlan-4', 6.5, 3.6, 0.2, -0.24);

  // Side colonnade density only — far from the opening view and talk shot.
  await put(scene, placed, MODEL.walkwayBay, 'kx-walk-w', -13, 4, Math.PI / 2, 0);
  await put(scene, placed, MODEL.walkwayBay, 'kx-walk-e', 13, -4, Math.PI / 2, 0);

  // Dragon finials on the ceremonial hall ridge ends (invented pack motif).
  await put(scene, placed, MODEL.roofFinial, 'kx-finial-l', -7.9, -8, Math.PI, 12.25);
  await put(scene, placed, MODEL.roofFinial, 'kx-finial-r', 7.9, -8, 0, 12.25);

  // Bronze bell near the north gate, outside the opening near plane.
  await put(scene, placed, MODEL.bell, 'kx-bell-gate', -6.8, 12.2, 0.2, 0);

  await dressKangxiMeshy(scene, placed);

  return placed;
}

/** Mid-ground hanging lanterns, one garden moon-gate, and one east-garden pavilion. */
export const MESHY_COURT = {
  moonGate: { x: 9.3, z: -1.8, rotY: Math.PI / 2, scale: 3.4, y: 0 },
  pavilion: { x: 11.5, z: -8.2, rotY: 0.2, scale: 3.5, y: 0 }
} as const;

const MESHY_LANTERN_SPOTS: Array<[number, number, number, number]> = [
  // x, y, z, scale — same mid-ground hang points as the old procedural lanterns.
  [-5.2, 2.55, -2.2, 0.62],
  [-5.2, 2.55, -5.4, 0.62],
  [4.8, 2.55, -2.4, 0.62],
  [4.8, 2.55, -5.4, 0.62],
  [-3.6, 2.7, -3.6, 0.66],
  [3.6, 2.7, -3.6, 0.66],
  [-8.6, 2.45, 3.2, 0.56],
  [8.2, 2.45, 2.8, 0.56],
  [8.2, 2.45, -1.5, 0.56],
  [-6.4, 2.6, 11.4, 0.6],
  [6.4, 2.6, 11.4, 0.6],
  [0, 3.1, -4.2, 0.68],
  [-2.2, 2.5, -6.6, 0.6],
  [2.2, 2.5, -6.6, 0.6]
];

async function dressKangxiMeshy(scene: Scene, placed: PlacedModel[]): Promise<void> {
  for (let i = 0; i < MESHY_LANTERN_SPOTS.length; i++) {
    const [x, y, z, s] = MESHY_LANTERN_SPOTS[i];
    await put(scene, placed, MODEL.meshyLantern, `meshy-lantern-${i}`, x, z, 0, y, s);
  }
  const g = MESHY_COURT.moonGate;
  await put(scene, placed, MODEL.meshyMoonGate, 'meshy-moon-gate', g.x, g.z, g.rotY, g.y, g.scale);
  const pavil = MESHY_COURT.pavilion;
  await put(scene, placed, MODEL.meshyPavilion, 'meshy-pavilion', pavil.x, pavil.z, pavil.rotY, pavil.y, pavil.scale);

  // Pretty face of the pot (concept 3/4) is toward azim 36°. rotY turns that face.
  const face = (deg: number) => ((deg - 36) * Math.PI) / 180;
  // Path-side and mid-ground pots. Pretty side faces the walk / court, not the hollow back.
  const peonies: Array<[number, number, number, number]> = [
    // x, z, rotY, scale
    [-5.85, 0.4, face(90), 0.42],
    [-6.05, -3.9, face(90), 0.42],
    [2.15, -2.8, face(270), 0.42],
    [2.35, -5.6, face(270), 0.42],
    [6.4, -2.2, face(260), 0.45],
    [7.6, -4.8, face(250), 0.48],
    [10.4, -5.0, face(250), 0.5],
    [9.6, -8.6, face(230), 0.5],
    [4.8, 8.4, face(200), 0.42],
    [6.4, 10.6, face(210), 0.42]
  ];
  for (let i = 0; i < peonies.length; i++) {
    const [x, z, rot, s] = peonies[i];
    await put(scene, placed, MODEL.meshyPeony, `meshy-peony-${i}`, x, z, rot, 0, s);
  }
  const stools: Array<[number, number, number, number]> = [
    [11.0, -0.6, 0.4, 0.36],
    [10.2, -6.2, -0.3, 0.36],
    [6.0, -4.4, 0.7, 0.36]
  ];
  for (let i = 0; i < stools.length; i++) {
    const [x, z, rot, s] = stools[i];
    await put(scene, placed, MODEL.meshyStool, `meshy-stool-${i}`, x, z, rot, 0, s);
  }

  // Central-aisle flagstones: mid-foreground to the hall, not in the opening
  // near plane (player starts at z=3). Spacing just above module depth 1.13
  // so edges do not overlap. y sits the slab on the courtyard ground.
  const flagZ = [1.55, 0.4, -0.75, -1.9, -3.05, -4.2, -5.35];
  for (let i = 0; i < flagZ.length; i++) {
    await put(
      scene,
      placed,
      MODEL.meshyFlagstones,
      `meshy-flagstones-${i}`,
      -3.25,
      flagZ[i],
      i % 2 === 0 ? 0 : Math.PI,
      0.015,
      1
    );
  }
}

/** Yongzheng hall clutter and a matching stone rail on the pale hall front. */
export async function dressYongzhengPack(scene: Scene): Promise<PlacedModel[]> {
  const placed: PlacedModel[] = [];

  // Hall is at (0, 0, -14). Cover the pale front rail, leave a central stair/dais gap.
  await put(scene, placed, MODEL.balustrade, 'yz-rail-l', -4.85, -7.15, 0, 1.1, 1.12);
  await put(scene, placed, MODEL.balustrade, 'yz-rail-r', 4.85, -7.15, 0, 1.1, 1.12);

  // Latticed doors at the sides of the hall mouth — frames the aisle, does not block the emperor.
  await put(scene, placed, MODEL.latticeDoor, 'yz-lattice-l', -5.8, -9.5, 0, 0);
  await put(scene, placed, MODEL.latticeDoor, 'yz-lattice-r', 5.8, -9.5, 0, 0);

  // Scroll pair (pack states no written characters) on the side walls.
  await put(scene, placed, MODEL.hangingScrolls, 'yz-scroll-l', -8.6, -11.2, Math.PI / 2, 1.7);
  await put(scene, placed, MODEL.hangingScrolls, 'yz-scroll-r', 8.6, -11.2, -Math.PI / 2, 1.7);

  // East sitting / scholar corner, clear of the carpet and the west treasury.
  await put(scene, placed, MODEL.teaTable, 'yz-tea-table', 8.5, 1.0, 0.3, 0);
  await put(scene, placed, MODEL.teaSet, 'yz-tea-set', 8.5, 1.0, 0.3, 0.42);
  await put(scene, placed, MODEL.guqin, 'yz-guqin', 9.2, 2.6, Math.PI / 2, 0);
  await put(scene, placed, MODEL.desk, 'yz-desk', 8.6, 3.8, -0.4, 0);
  await put(scene, placed, MODEL.inkstone, 'yz-ink', 8.6, 3.5, 0.2, 0.72);
  await put(scene, placed, MODEL.brush, 'yz-brush', 8.3, 4.1, 0.5, 0.72);
  await put(scene, placed, MODEL.cushion, 'yz-cushion', 7.4, 1.5, 0.2, 0);

  // Bell just inside the south gate.
  await put(scene, placed, MODEL.bell, 'yz-bell', -6.4, 15.4, 0.15, 0);

  // Finials on the hall roof.
  await put(scene, placed, MODEL.roofFinial, 'yz-finial-l', -7.9, -14, Math.PI, 12.25);
  await put(scene, placed, MODEL.roofFinial, 'yz-finial-r', 7.9, -14, 0, 12.25);

  return placed;
}

/** Keep distant shore pavilions from washing out to white in fog. */
export function protectDistantPavilions(scene: Scene): void {
  for (const mesh of scene.meshes) {
    const n = (mesh.name + ' ' + (mesh.parent?.name ?? '')).toLowerCase();
    if (!n.includes('pavilion') && !n.includes('heshen-pav') && !n.includes('coast-pav')) continue;
    if (n.includes('meshy-')) continue;
    const mat = mesh.material;
    if (!(mat instanceof PBRMaterial)) continue;
    const mn = mat.name.toLowerCase();
    if (mn.startsWith('palette-') || mn.startsWith('bridge-') || mn.startsWith('meshy-')) {
      mat.environmentIntensity = Math.min(mat.environmentIntensity ?? 0.22, 0.14);
      mesh.applyFog = true;
      continue;
    }
    try {
      mat.unfreeze();
    } catch {
      /* ok */
    }
    mat.environmentIntensity = Math.min(mat.environmentIntensity ?? 0.22, 0.14);
    mesh.applyFog = true;
  }
}
