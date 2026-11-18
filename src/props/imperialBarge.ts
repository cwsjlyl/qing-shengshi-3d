import {
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer
} from '@babylonjs/core';
import { PALETTE, stdMat } from '../engine/materials';

export type Barge = {
  root: TransformNode;
  deckY: number;
  length: number;
  width: number;
  boardPoint: Vector3;
};

function add(mesh: Mesh, parent: TransformNode, mat: StandardMaterial, x: number, y: number, z: number): Mesh {
  mesh.parent = parent;
  mesh.material = mat;
  mesh.position.set(x, y, z);
  mesh.isPickable = false;
  return mesh;
}

function paperLantern(scene: Scene, parent: TransformNode, matPaper: StandardMaterial, matGold: StandardMaterial, x: number, y: number, z: number, s = 1): void {
  const body = MeshBuilder.CreateCylinder('lantern', { height: 0.34 * s, diameter: 0.26 * s, tessellation: 8 }, scene);
  add(body, parent, matPaper, x, y, z);
  const cap = MeshBuilder.CreateCylinder('lanCap', { height: 0.05 * s, diameter: 0.3 * s, tessellation: 8 }, scene);
  add(cap, parent, matGold, x, y + 0.18 * s, z);
  const capB = cap.clone('lanCapB')!;
  capB.parent = parent;
  capB.position.set(x, y - 0.18 * s, z);
}

/**
 * Stylised low-poly imperial junk / 南巡 flagship.
 * Curved hull, wooden deck, pavilion cabin, battened junk sails, hanging lanterns.
 */
export function buildImperialBarge(scene: Scene, name = 'imperial-barge', scale = 1): Barge {
  const root = new TransformNode(name, scene);
  root.scaling.setAll(scale);

  const hullRed = stdMat(scene, '#8B1A1A', { specular: 0.3 });
  const hullBlack = stdMat(scene, '#1A1210', { specular: 0.18 });
  const gold = stdMat(scene, PALETTE.gold, { specular: 0.55, emissive: 0.08 });
  const goldBright = stdMat(scene, PALETTE.goldBright, { specular: 0.6, emissive: 0.1 });
  const deckM = stdMat(scene, '#8A6236', { specular: 0.1 });
  const plankM = stdMat(scene, '#6E4A28', { specular: 0.1 });
  const roofM = stdMat(scene, '#C9A227', { specular: 0.35, emissive: 0.05 });
  const roofRidge = stdMat(scene, '#6B1020', { specular: 0.2 });
  const sailM = stdMat(scene, '#F3E4C0', { specular: 0.1, emissive: 0.12 });
  try { sailM.unfreeze(); } catch { /* ok */ }
  sailM.backFaceCulling = false;
  sailM.twoSidedLighting = true;
  const mastM = stdMat(scene, '#4A3218', { specular: 0.1 });
  const railM = stdMat(scene, '#D4A84A', { specular: 0.4 });
  const paperM = stdMat(scene, '#C03028', { specular: 0.18, emissive: 0.28 });

  const L = 28;
  const W = 7.2;
  const deckY = 1.72;

  // Curved hull: a box whose vertices are tapered and given a rocker.
  // Height is kept below the deck so the top reads as wood, not a red slab.
  const hull = MeshBuilder.CreateBox('hull', { width: W, height: 1.7, depth: L, updatable: true }, scene);
  const hp = hull.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < hp.length; i += 3) {
    const x = hp[i];
    const y = hp[i + 1];
    const z = hp[i + 2];
    const along = Math.abs(z) / (L * 0.5);
    const taper = 1 - Math.pow(along, 2) * 0.48;
    hp[i] = x * taper;
    if (y < 0) {
      hp[i + 1] = y + Math.pow(along, 2) * 0.85;
    }
    if (z > L * 0.35 && y > 0) {
      hp[i + 2] = z + 0.6; // slightly pointed bow
    }
  }
  hull.updateVerticesData(VertexBuffer.PositionKind, hp);
  hull.createNormals(false);
  add(hull, root, hullRed, 0, 0.72, 0);

  // Dark lower strake
  const keel = MeshBuilder.CreateBox('keel', { width: W * 0.82, height: 0.7, depth: L * 0.9, updatable: true }, scene);
  const kp = keel.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < kp.length; i += 3) {
    const z = kp[i + 2];
    const along = Math.abs(z) / (L * 0.45);
    kp[i] *= 1 - Math.pow(Math.min(1, along), 2) * 0.5;
    if (kp[i + 1] < 0) kp[i + 1] += Math.pow(Math.min(1, along), 2) * 0.5;
  }
  keel.updateVerticesData(VertexBuffer.PositionKind, kp);
  keel.createNormals(false);
  add(keel, root, hullBlack, 0, 0.2, 0);

  const strake = MeshBuilder.CreateBox('strake', { width: W + 0.12, height: 0.1, depth: L * 0.88 }, scene);
  add(strake, root, gold, 0, 1.55, 0);

  // Full wooden deck: lengthwise planks with visible seams, above the red hull.
  const deck = MeshBuilder.CreateBox('deck', { width: W * 0.92, height: 0.1, depth: L * 0.86 }, scene);
  add(deck, root, deckM, 0, deckY, 0);
  const plankW = 0.42;
  const nPlanks = 15;
  const deckW = W * 0.9;
  for (let i = 0; i < nPlanks; i++) {
    const x = -deckW * 0.5 + plankW * 0.5 + i * (deckW / nPlanks);
    const mat = i % 2 === 0 ? deckM : plankM;
    const plank = MeshBuilder.CreateBox(`plank${i}`, { width: plankW - 0.04, height: 0.06, depth: L * 0.84 }, scene);
    add(plank, root, mat, x, deckY + 0.07, 0);
  }
  // Narrow ceremonial runner so the deck still feels imperial, but wood stays dominant.
  const runner = MeshBuilder.CreateBox('runner', { width: 0.7, height: 0.02, depth: L * 0.5 }, scene);
  add(runner, root, hullRed, 0, deckY + 0.11, -1.2);

  // Railings with posts
  for (const x of [-W * 0.42, W * 0.42]) {
    const rail = MeshBuilder.CreateBox(`rail${x}`, { width: 0.07, height: 0.12, depth: L * 0.78 }, scene);
    add(rail, root, railM, x, deckY + 0.5, 0);
    for (let z = -10; z <= 10; z += 2.5) {
      const post = MeshBuilder.CreateBox(`rpost${x}${z}`, { width: 0.07, height: 0.48, depth: 0.07 }, scene);
      add(post, root, railM, x, deckY + 0.28, z);
    }
  }

  // Abstract dragon prow
  const prow = new TransformNode('prow', scene);
  prow.parent = root;
  prow.position.set(0, 2.05, L * 0.48);
  const neck = MeshBuilder.CreateCylinder('dragonNeck', { height: 2.0, diameter: 0.55, tessellation: 7 }, scene);
  add(neck, prow, gold, 0, 0.7, 0.15);
  neck.rotation.x = -0.75;
  const head = MeshBuilder.CreateBox('dragonHead', { width: 0.8, height: 0.55, depth: 1.05 }, scene);
  add(head, prow, goldBright, 0, 1.55, 0.85);
  const jaw = MeshBuilder.CreateBox('jaw', { width: 0.6, height: 0.16, depth: 0.7 }, scene);
  add(jaw, prow, gold, 0, 1.22, 1.05);
  const hornL = MeshBuilder.CreateCylinder('hornL', { height: 0.7, diameterTop: 0.04, diameterBottom: 0.14, tessellation: 5 }, scene);
  add(hornL, prow, goldBright, -0.22, 2.0, 0.55);
  hornL.rotation.x = -0.55;
  const hornR = hornL.clone('hornR')!;
  hornR.parent = prow;
  hornR.position.x = 0.22;

  // Stern rise
  const stern = MeshBuilder.CreateBox('stern', { width: W * 0.7, height: 1.3, depth: 3.4 }, scene);
  add(stern, root, hullRed, 0, deckY + 0.7, -L * 0.38);

  // Pavilion cabin — walls + arched / flared gold roof
  const cabin = new TransformNode('cabin', scene);
  cabin.parent = root;
  cabin.position.set(0, deckY, -1.2);
  const walls = MeshBuilder.CreateBox('cabinWalls', { width: 4.4, height: 2.15, depth: 6.0 }, scene);
  add(walls, cabin, hullRed, 0, 1.1, 0);
  // Window frames
  for (const z of [-1.6, 0, 1.6]) {
    for (const x of [-2.22, 2.22]) {
      const win = MeshBuilder.CreateBox(`win${x}${z}`, { width: 0.08, height: 0.7, depth: 0.7 }, scene);
      add(win, cabin, gold, x, 1.25, z);
    }
  }
  const door = MeshBuilder.CreateBox('cabinDoor', { width: 0.9, height: 1.4, depth: 0.08 }, scene);
  add(door, cabin, gold, 0, 0.8, 3.05);

  // Flared pavilion roof (two stacked, slightly wider eaves)
  const roof1 = MeshBuilder.CreateCylinder('roof1', { height: 5.2, diameterTop: 0.2, diameterBottom: 6.4, tessellation: 8 }, scene);
  add(roof1, cabin, roofM, 0, 2.55, 0);
  roof1.rotation.z = Math.PI / 2;
  roof1.scaling.y = 0.22;
  roof1.rotation.y = Math.PI / 2;
  // The cylinder-as-roof is awkward. Use a flattened box with upturned ends instead.
  roof1.isVisible = false;
  const roofBox = MeshBuilder.CreateBox('roofBox', { width: 5.4, height: 0.28, depth: 7.2 }, scene);
  add(roofBox, cabin, roofM, 0, 2.3, 0);
  const eaveL = MeshBuilder.CreateBox('eaveL', { width: 0.5, height: 0.16, depth: 7.4 }, scene);
  add(eaveL, cabin, roofM, -2.7, 2.15, 0);
  eaveL.rotation.z = 0.25;
  const eaveR = eaveL.clone('eaveR')!;
  eaveR.parent = cabin;
  eaveR.position.x = 2.7;
  eaveR.rotation.z = -0.25;
  const ridge = MeshBuilder.CreateBox('ridge', { width: 0.22, height: 0.22, depth: 7.0 }, scene);
  add(ridge, cabin, roofRidge, 0, 2.5, 0);
  const peak = MeshBuilder.CreateBox('peak', { width: 0.3, height: 0.5, depth: 0.3 }, scene);
  add(peak, cabin, gold, 0, 2.85, 0);

  // Upper lookout
  const look = MeshBuilder.CreateBox('look', { width: 2.6, height: 1.0, depth: 2.8 }, scene);
  add(look, cabin, hullRed, 0, 2.95, -0.2);
  const roof2 = MeshBuilder.CreateBox('roof2', { width: 3.3, height: 0.2, depth: 3.5 }, scene);
  add(roof2, cabin, roofM, 0, 3.55, -0.2);
  const ridge2 = MeshBuilder.CreateBox('ridge2', { width: 0.16, height: 0.16, depth: 3.4 }, scene);
  add(ridge2, cabin, roofRidge, 0, 3.7, -0.2);

  // Masts + trapezoid junk sails
  const masts: Array<[number, number]> = [
    [8.2, 11.5],
    [-9.5, 9.2]
  ];
  masts.forEach(([z, h], i) => {
    const mast = MeshBuilder.CreateCylinder(`mast${i}`, { height: h, diameter: 0.22, tessellation: 6 }, scene);
    add(mast, root, mastM, 0, deckY + h * 0.5, z);
    const sailH = i === 0 ? 7.4 : 5.8;
    const topW = i === 0 ? 3.2 : 2.6;
    const botW = i === 0 ? 5.2 : 4.2;
    const sail = MeshBuilder.CreateRibbon(
      `sail${i}`,
      {
        pathArray: [
          [new Vector3(botW * 0.5, 0, 0), new Vector3(topW * 0.5, sailH, 0)],
          [new Vector3(-botW * 0.5, 0, 0), new Vector3(-topW * 0.5, sailH, 0)]
        ],
        sideOrientation: Mesh.DOUBLESIDE,
        closeArray: false,
        updatable: false
      },
      scene
    );
    add(sail, root, sailM, 0, deckY + 1.5, z + 0.18);
    for (let b = 0; b < 6; b++) {
      const t = b / 5;
      const w = botW + (topW - botW) * t;
      const bat = MeshBuilder.CreateBox(`bat${i}${b}`, { width: w + 0.15, height: 0.05, depth: 0.07 }, scene);
      add(bat, root, mastM, 0, deckY + 1.5 + t * sailH, z + 0.22);
    }
    const yard = MeshBuilder.CreateBox(`yard${i}`, { width: topW + 0.3, height: 0.08, depth: 0.1 }, scene);
    add(yard, root, mastM, 0, deckY + 1.5 + sailH, z + 0.15);
    const banner = MeshBuilder.CreateBox(`banner${i}`, { width: 0.08, height: 1.8, depth: 0.55 }, scene);
    add(banner, root, hullRed, 0.85, deckY + h - 0.2, z);
    const cap = MeshBuilder.CreateSphere(`mastCap${i}`, { diameter: 0.26, segments: 5 }, scene);
    add(cap, root, gold, 0, deckY + h + 0.08, z);
  });

  // Hanging paper lanterns along the rail
  for (const z of [-9, -5, -1, 4, 8, 11]) {
    for (const x of [-W * 0.42, W * 0.42]) {
      const pole = MeshBuilder.CreateCylinder(`lp${x}${z}`, { height: 0.55, diameter: 0.05, tessellation: 5 }, scene);
      add(pole, root, mastM, x, deckY + 0.82, z);
      paperLantern(scene, root, paperM, gold, x, deckY + 1.2, z, 0.95);
    }
  }

  // Bowsprit + flag
  const pole = MeshBuilder.CreateCylinder('bowPole', { height: 3.0, diameter: 0.1, tessellation: 5 }, scene);
  add(pole, root, mastM, 0, deckY + 2.0, L * 0.36);
  const flag = MeshBuilder.CreateBox('flag', { width: 1.3, height: 0.85, depth: 0.04 }, scene);
  add(flag, root, hullRed, 0.65, deckY + 3.3, L * 0.36);

  return { root, deckY, length: L, width: W, boardPoint: new Vector3(0, deckY, L * 0.22) };
}

export function buildEscortJunk(scene: Scene, name: string, scale = 0.55): TransformNode {
  return buildImperialBarge(scene, name, scale).root;
}

