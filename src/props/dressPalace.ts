import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { PALETTE, stdMat } from '../engine/materials';

/** Grey-blue courtyard brick with dark grout — not cream/sand cobble. */
export function makeCobbleTexture(scene: Scene, uScale = 8, vScale = 8): Texture {
  const size = 512;
  const tex = new DynamicTexture('cobble-tex', { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#3A4248';
  ctx.fillRect(0, 0, size, size);
  const palettes = ['#8A9198', '#7C848C', '#939AA2', '#6E767E', '#868E96', '#798088', '#9AA3A8', '#747C84', '#8E969C'];
  let seed = 17;
  const rnd = () => {
    seed = (seed * 16807 + 13) % 2147483647;
    return seed / 2147483647;
  };
  for (let row = 0; row < 36; row++) {
    const odd = row % 2;
    const pyBase = row * 15 - 4;
    for (let col = -1; col < 34; col++) {
      const px = col * 16 + odd * 8 + (rnd() - 0.5) * 6;
      const py = pyBase + (rnd() - 0.5) * 5;
      const w = 11 + rnd() * 8;
      const h = 8 + rnd() * 6;
      const colr = palettes[Math.floor(rnd() * palettes.length)];
      ctx.fillStyle = colr;
      roundRect(ctx, px, py, w, h, 2 + rnd() * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,36,42,0.16)';
      roundRect(ctx, px + w * 0.15, py + h * 0.45, w * 0.7, h * 0.45, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(28,32,36,0.62)';
      ctx.lineWidth = 1.4;
      roundRect(ctx, px, py, w, h, 2);
      ctx.stroke();
    }
  }
  tex.update(false);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = uScale;
  tex.vScale = vScale;
  tex.anisotropicFilteringLevel = 4;
  return tex;
}

function roundRect(ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void; closePath(): void }, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Retint paving, shrink/hide near-plane stone lanterns, add grass verges and warm paper lanterns.
 * Must run before freezeStatic on the courtyard root.
 */
export function dressCourtyard(scene: Scene, court: TransformNode): void {
  // Detach the small arched bridge onto its own grey-veined material before
  // any shared stone / pond-edge ochre tint can recolour it.
  retintStoneBridges(scene, court);
  const cobble = makeCobbleTexture(scene);
  const pavingMat = new PBRMaterial('paving-cobble', scene);
  pavingMat.albedoColor = new Color3(0.72, 0.76, 0.78);
  pavingMat.albedoTexture = cobble;
  pavingMat.roughness = 0.88;
  pavingMat.metallic = 0;
  pavingMat.environmentIntensity = 0.16;
  pavingMat.specularIntensity = 0.15;

  const paperRed = new PBRMaterial('lantern-paper-red', scene);
  paperRed.albedoColor = new Color3(0.78, 0.16, 0.12);
  paperRed.emissiveColor = new Color3(0.45, 0.08, 0.04);
  paperRed.roughness = 0.55;
  paperRed.metallic = 0;
  paperRed.environmentIntensity = 0.12;

  for (const mesh of court.getChildMeshes(false)) {
    const name = mesh.name.toLowerCase();
    const parentName = (mesh.parent?.name ?? '').toLowerCase();
    const combined = name + ' ' + parentName;
    if (combined.includes('courtyard-paving-module')) {
      mesh.material = pavingMat;
    }
    if (combined.includes('hanging-silk-lantern') && (combined.includes('paper') || name.includes('paper'))) {
      mesh.material = paperRed;
    }
  }

  for (const node of court.getChildTransformNodes(false)) {
    const name = node.name;
    const isInstanceRoot =
      /standing-garden-lantern$/.test(name) ||
      /hanging-silk-lantern$/.test(name) ||
      /floating-water-lantern$/.test(name);
    if (!isInstanceRoot) continue;
    const p = node.position;
    // Hide anything sitting in the Kangxi opening near plane (right of the west aisle, z≈5–10).
    const inNearPlane = p.z > 4.2 && p.z < 10.5 && p.x > -1.2 && p.x < 8.5;
    if (inNearPlane) {
      node.setEnabled(false);
      continue;
    }
    if (/standing-garden-lantern$/.test(name)) {
      node.scaling.setAll(0.55);
    }
  }
  for (const node of court.getChildTransformNodes(false)) {
    const name = node.name;
    const p = node.position;
    if (/bronze-tripod-cauldron$/.test(name)) {
      if (p.z > -3 && p.z < 5 && p.x > -6.5 && p.x < 6.5) {
        node.position.set(p.x < 0 ? -11.2 : 11.2, p.y, -8.4);
      }
    }
    // Keep the south approach to the throne clear for talk framing.
    if (/standing-garden-lantern$/.test(name) && p.x < -8 && p.z > 1 && p.z < 6.5) {
      node.position.set(-12.2, p.y, 9.4);
      node.scaling.setAll(0.5);
    }
    if (/ceremonial-drum-on-stand$/.test(name) && p.x < -8 && p.z > 0 && p.z < 4) {
      node.position.set(-12.0, p.y, 3.4);
    }
    if (/bronze-bell-on-frame$/.test(name) && p.x < -8 && p.z > -3 && p.z < 1) {
      node.position.set(-12.0, p.y, -1.0);
    }
    if (/peony-planter$/.test(name) && p.x < -8 && p.z > -5 && p.z < 6) {
      node.position.set(-12.4, p.y, -3.6);
    }
    // The west pond pavilion sat in the line of sight to the throne. Shift it to the east garden.
    if (/water-pavilion$/.test(name) && p.x < -2 && p.x > -8 && p.z > 0 && p.z < 5) {
      node.position.set(11.2, p.y, 8.6);
    }
    if (/(low-tea-table|tea-set-on-tray|floor-cushion-set|guqin-on-stand)$/.test(name) && p.x < -3 && p.x > -8 && p.z > 0 && p.z < 5) {
      node.position.set(p.x + 16.2, p.y, p.z + 6.0);
    }
    if (/lotus-cluster$/.test(name) && p.x < -5 && p.z > 0 && p.z < 4) {
      node.position.set(10.2, p.y, 8.2);
    }
  }

  addGrassVerge(scene, court);
  // Mid-ground hanging lanterns are Meshy instances, placed in dressKangxiPack.
  addPathFlowers(scene, court);
  addPavingOverlay(scene, court);
}

function addGrassVerge(scene: Scene, parent: TransformNode): void {
  const grass = stdMat(scene, '#24582A', { specular: 0.04 });
  const grassDeep = stdMat(scene, '#1C4A22', { specular: 0.04 });
  // Geometric green slabs removed — pack lotus pond edges now line the aisle.
  // Soft tufts only, kept on the water side of the lips (not on the walkway).
  let seed = 91;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const tuftPts: Array<[number, number]> = [
    [-8.0, 2.2],
    [-8.2, 5.0],
    [-0.4, 2.0],
    [-0.35, 5.4],
    [-7.2, -0.8],
    [-0.5, -0.8],
    [-5.8, 8.2]
  ];
  tuftPts.forEach((p, i) => {
    const t = MeshBuilder.CreateCylinder(
      `tuft${i}`,
      { height: 0.22 + rnd() * 0.12, diameterTop: 0.04, diameterBottom: 0.22 + rnd() * 0.08, tessellation: 5 },
      scene
    );
    t.parent = parent;
    t.material = rnd() > 0.5 ? grass : grassDeep;
    t.position.set(p[0], 0.12, p[1]);
    t.isPickable = false;
  });
}


function addPavingOverlay(scene: Scene, parent: TransformNode): void {
  // Continuous cobble planes hide the 4×4 pack module seams on walkable ground, leaving the ponds open.
  const patches: Array<[string, number, number, number, number]> = [
    // name, cx, cz, width, depth — courtyard is ~28×28, ponds at x=-8.35..-4.5 and -2.0..0.35, z=-0.35..8.4
    ['pave-west', -11.175, 0, 5.65, 28],
    ['pave-aisle', -3.25, 0, 2.5, 28],
    ['pave-east', 7.175, 0, 13.65, 28],
    ['pave-south', -4.0, -7.175, 8.7, 13.65],
    ['pave-north', -4.0, 11.2, 8.7, 5.6]
  ];
  for (const [name, cx, cz, w, d] of patches) {
    const tex = makeCobbleTexture(scene, w / 0.9, d / 0.9);
    tex.name = name + '-tex';
    const m = new PBRMaterial(name + '-mat', scene);
    m.albedoColor = new Color3(0.68, 0.72, 0.74);
    m.albedoTexture = tex;
    m.roughness = 0.92;
    m.metallic = 0;
    m.environmentIntensity = 0.12;
    m.specularIntensity = 0.1;
    const g = MeshBuilder.CreateGround(name, { width: w, height: d, subdivisions: 1 }, scene);
    g.parent = parent;
    g.position.set(cx, 0.05, cz);
    g.material = m;
    g.isPickable = false;
    g.receiveShadows = true;
  }
}

function hangPaperLanterns(scene: Scene, parent: TransformNode): void {
  const spots: Array<[number, number, number, number]> = [
    // x, y, z, scale — mid-ground colourful lanterns, kept out of the opening near plane
    [-5.2, 2.55, -2.2, 1],
    [-5.2, 2.55, -5.4, 1],
    [4.8, 2.55, -2.4, 1],
    [4.8, 2.55, -5.4, 1],
    [-3.6, 2.7, -3.6, 1.05],
    [3.6, 2.7, -3.6, 1.05],
    [-8.6, 2.45, 3.2, 0.9],
    [8.2, 2.45, 2.8, 0.9],
    [8.2, 2.45, -1.5, 0.9],
    [-6.4, 2.6, 11.4, 0.95],
    [6.4, 2.6, 11.4, 0.95],
    [0, 3.1, -4.2, 1.1],
    [-2.2, 2.5, -6.6, 0.95],
    [2.2, 2.5, -6.6, 0.95]
  ];
  spots.forEach((s, i) => addPaperLantern(scene, parent, `court-lantern-${i}`, s[0], s[1], s[2], s[3]));
}


function addPathFlowers(scene: Scene, parent: TransformNode): void {
  const leaf = stdMat(scene, '#3A7A32', { specular: 0.05 });
  const bloomA = stdMat(scene, '#D06070', { specular: 0.12, emissive: 0.12 });
  const bloomB = stdMat(scene, '#E8D080', { specular: 0.12, emissive: 0.1 });
  const bloomC = stdMat(scene, '#E8A0B0', { specular: 0.12, emissive: 0.1 });
  const blooms = [bloomA, bloomB, bloomC];
  // Tufts along the central path toward the hall, kept off the Meshy
  // flagstone run (x=-3.25 ±0.95, z≈-5.9..2.1) and out of the player's feet.
  const spots: Array<[number, number]> = [
    [-1.95, -2.4],
    [2.2, -2.4],
    [-1.95, -0.4],
    [2.6, -0.4],
    [-1.95, 1.6],
    [2.4, 1.6],
    [-5.8, -3.2],
    [5.2, -3.0],
    [-1.95, -3.6],
    [2.8, -3.6],
    [-6.2, -5.2],
    [4.8, -5.0]
  ];
  spots.forEach((s, i) => {
    const bush = MeshBuilder.CreateCylinder(
      `flowerBush${i}`,
      { height: 0.28, diameterTop: 0.12, diameterBottom: 0.38, tessellation: 6 },
      scene
    );
    bush.parent = parent;
    bush.material = leaf;
    bush.position.set(s[0], 0.14, s[1]);
    bush.isPickable = false;
    for (let k = 0; k < 3; k++) {
      const flower = MeshBuilder.CreateSphere(`flower${i}${k}`, { diameter: 0.11, segments: 5 }, scene);
      flower.parent = parent;
      flower.material = blooms[(i + k) % blooms.length];
      flower.position.set(s[0] + (k - 1) * 0.1, 0.3 + (k % 2) * 0.04, s[1] + (k === 1 ? 0.08 : -0.04));
      flower.isPickable = false;
    }
  });
}

export function addPaperLantern(
  scene: Scene,
  parent: TransformNode,
  name: string,
  x: number,
  y: number,
  z: number,
  scale = 1
): Mesh {
  const paper = stdMat(scene, '#C03028', { specular: 0.2, emissive: 0.32 });
  const gold = stdMat(scene, PALETTE.gold, { specular: 0.45, emissive: 0.08 });
  const root = new TransformNode(name, scene);
  root.parent = parent;
  root.position.set(x, y, z);
  root.scaling.setAll(scale);
  const body = MeshBuilder.CreateCylinder(`${name}-body`, { height: 0.42, diameter: 0.32, tessellation: 8 }, scene);
  body.parent = root;
  body.material = paper;
  body.isPickable = false;
  const cap = MeshBuilder.CreateCylinder(`${name}-cap`, { height: 0.06, diameter: 0.36, tessellation: 8 }, scene);
  cap.parent = root;
  cap.material = gold;
  cap.position.y = 0.22;
  cap.isPickable = false;
  const capB = cap.clone(`${name}-capB`)!;
  capB.parent = root;
  capB.position.y = -0.22;
  const tassel = MeshBuilder.CreateCylinder(`${name}-tassel`, { height: 0.16, diameter: 0.03, tessellation: 4 }, scene);
  tassel.parent = root;
  tassel.material = gold;
  tassel.position.y = -0.32;
  tassel.isPickable = false;
  return body;
}

/** Scale standalone standing-lantern placements down and warm their paper. */
export function tameStandingLanterns(root: TransformNode, scale = 0.55): void {
  for (const mesh of root.getChildMeshes(false)) mesh.unfreezeWorldMatrix();
  root.scaling.setAll(scale);
  root.computeWorldMatrix(true);
  for (const mesh of root.getChildMeshes(false)) {
    const mat = mesh.material;
    const n = (mesh.name + ' ' + (mesh.parent?.name ?? '')).toLowerCase();
    if (!n.includes('paper') && !n.includes('lantern')) continue;
    if (mat instanceof PBRMaterial) {
      const luma = 0.2126 * mat.albedoColor.r + 0.7152 * mat.albedoColor.g + 0.0722 * mat.albedoColor.b;
      if (luma > 0.55) {
        mat.albedoColor = new Color3(0.78, 0.18, 0.12);
        mat.emissiveColor = new Color3(0.4, 0.08, 0.04);
      }
    }
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
  }
}

export function dressFarmland(scene: Scene, cx: number, cz: number): TransformNode {
  const root = new TransformNode('farm-dress', scene);
  root.position.set(cx, 0.07, cz);

  const dirt = stdMat(scene, '#6A4E2A', { specular: 0.06 });
  const dust = stdMat(scene, '#8A6A3A', { specular: 0.05 });
  const cropA = stdMat(scene, '#5A9E3A', { specular: 0.06, emissive: 0.14 });
  const cropB = stdMat(scene, '#8BB04A', { specular: 0.06, emissive: 0.12 });
  const cropDry = stdMat(scene, '#C4B04A', { specular: 0.05, emissive: 0.1 });
  const mud = stdMat(scene, '#4A6A48', { specular: 0.2 });
  const bank = stdMat(scene, '#6B5230', { specular: 0.05 });
  const weed = stdMat(scene, '#3A6A30', { specular: 0.05 });

  const path = MeshBuilder.CreateBox('farm-path', { width: 2.4, height: 0.07, depth: 20 }, scene);
  path.parent = root;
  path.material = dirt;
  path.position.set(0.2, 0.02, 0);
  path.isPickable = false;
  const path2 = MeshBuilder.CreateBox('farm-path-e', { width: 10, height: 0.06, depth: 1.6 }, scene);
  path2.parent = root;
  path2.material = dust;
  path2.position.set(2.5, 0.015, 3.4);
  path2.isPickable = false;

  // Wilted / sparse crop rows, with a clearing around the two farmers near (0.5, -0.5) and (3.8, -2.2) in local space.
  let seed = 210;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  let n = 0;
  for (let row = -5; row <= 5; row++) {
    if (row === 0) continue;
    const x = row * 2.15;
    const ridge = MeshBuilder.CreateBox(`ridge${row}`, { width: 0.85, height: 0.1, depth: 18 }, scene);
    ridge.parent = root;
    ridge.material = bank;
    ridge.position.set(x, 0.02, -0.4);
    ridge.isPickable = false;
    for (let i = -8; i <= 8; i++) {
      const z = i * 1.05;
      // Leave space around the farmers so they stay readable.
      if (Math.abs(x - 0.5) < 1.8 && Math.abs(z + 0.5) < 1.6) continue;
      if (Math.abs(x - 3.8) < 1.8 && Math.abs(z + 2.2) < 1.6) continue;
      if (rnd() < 0.18) continue; // sparse gaps
      const roll = rnd();
      const mat = roll < 0.3 ? cropDry : roll < 0.65 ? cropB : cropA;
      const baseX = x + (rnd() - 0.5) * 0.28;
      // A small cluster of thin green / yellow-green shoots, not a brown cone.
      for (let s = 0; s < 3; s++) {
        const h = 0.34 + rnd() * 0.28;
        const shoot = MeshBuilder.CreateCylinder(
          `crop${n++}`,
          { height: h, diameterTop: 0.02, diameterBottom: 0.055, tessellation: 4 },
          scene
        );
        shoot.parent = root;
        shoot.material = mat;
        shoot.position.set(baseX + (s - 1) * 0.07, h * 0.5, z + (s === 1 ? 0.05 : -0.03));
        shoot.rotation.z = (s - 1) * 0.22;
        shoot.rotation.x = (rnd() - 0.5) * 0.12;
        shoot.isPickable = false;
        const leaf = MeshBuilder.CreateBox(`cropLeaf${n}`, { width: 0.16, height: 0.03, depth: 0.07 }, scene);
        leaf.parent = root;
        leaf.material = mat;
        leaf.position.set(baseX + (s - 1) * 0.06, h * 0.7, z + 0.01);
        leaf.rotation.z = (s - 1) * 0.4;
        leaf.rotation.y = (s - 1) * 0.5;
        leaf.isPickable = false;
        if (s === 1) {
          const blade = MeshBuilder.CreateBox(`cropBlade${n}`, { width: 0.05, height: h * 0.7, depth: 0.018 }, scene);
          blade.parent = root;
          blade.material = mat;
          blade.position.set(baseX + 0.04, h * 0.38, z + 0.03);
          blade.rotation.z = 0.35;
          blade.isPickable = false;
        }
      }
    }
  }

  // Two sparse paddy plots on the west side — muddy, not lush.
  const paddies: Array<[number, number, number, number]> = [
    [-9.2, -4.5, 5.2, 6.5],
    [-9.4, 3.6, 5.0, 5.8]
  ];
  paddies.forEach((p, i) => {
    const water = MeshBuilder.CreateBox(`paddy${i}`, { width: p[2], height: 0.05, depth: p[3] }, scene);
    water.parent = root;
    water.material = mud;
    water.position.set(p[0], 0.01, p[1]);
    water.isPickable = false;
    for (const [dx, dz] of [
      [-p[2] / 2, 0],
      [p[2] / 2, 0],
      [0, -p[3] / 2],
      [0, p[3] / 2]
    ] as Array<[number, number]>) {
      const isX = Math.abs(dx) > 0.1;
      const wall = MeshBuilder.CreateBox(
        `paddyBank${i}${dx}${dz}`,
        { width: isX ? 0.28 : p[2] + 0.28, height: 0.16, depth: isX ? p[3] + 0.28 : 0.28 },
        scene
      );
      wall.parent = root;
      wall.material = bank;
      wall.position.set(p[0] + dx, 0.06, p[1] + dz);
      wall.isPickable = false;
    }
    // A few rice clumps
    for (let k = 0; k < 8; k++) {
      const clump = MeshBuilder.CreateCylinder(
        `rice${i}${k}`,
        { height: 0.18, diameterTop: 0.04, diameterBottom: 0.14, tessellation: 5 },
        scene
      );
      clump.parent = root;
      clump.material = cropA;
      clump.position.set(p[0] + (rnd() - 0.5) * (p[2] - 0.8), 0.1, p[1] + (rnd() - 0.5) * (p[3] - 0.8));
      clump.isPickable = false;
    }
  });

  // Edge weeds / shrubs so the plot is not a hard dirt cut-out.
  const weeds: Array<[number, number]> = [
    [-12, -9],
    [-11, 8],
    [11, -8],
    [12, 7],
    [8, 9],
    [-13, 0],
    [10, -3],
    [-6, 9]
  ];
  weeds.forEach((p, i) => {
    const w = MeshBuilder.CreateCylinder(
      `weed${i}`,
      { height: 0.35 + (i % 3) * 0.1, diameterTop: 0.08, diameterBottom: 0.28, tessellation: 5 },
      scene
    );
    w.parent = root;
    w.material = weed;
    w.position.set(p[0], 0.18, p[1]);
    w.isPickable = false;
  });

  return root;
}


/** Cool grey stone with black veins / grout, used only on small stone bridges. */
export function retintStoneBridges(scene: Scene, root?: TransformNode): void {
  const meshes = root ? root.getChildMeshes(false) : scene.meshes;
  let mat: PBRMaterial | null = null;
  for (const mesh of meshes) {
    const label = `${mesh.name} ${mesh.parent?.name ?? ''}`.toLowerCase();
    if (!/(^|[-_\s\/])(bridge|arched-stone-bridge)($|[-_\s\/])/.test(label) && !label.includes('arched-stone-bridge') && !label.includes('coast-bridge') && !/stone-bridge/.test(label)) {
      continue;
    }
    if (/flagship|boat|ship|deck|player|char:/.test(label)) continue;
    if (!mat) mat = makeGreyVeinStone(scene);
    mesh.material = mat;
  }
}

function makeGreyVeinStone(scene: Scene): PBRMaterial {
  const existing = scene.getMaterialByName('bridge-grey-stone');
  if (existing instanceof PBRMaterial) return existing;
  const size = 512;
  const tex = new DynamicTexture('bridge-grey-vein-tex', { width: size, height: size }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#8A8D8C';
  ctx.fillRect(0, 0, size, size);
  let seed = 41;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  // Subtle cooler / darker stones so the slab does not read as one flat grey.
  for (let i = 0; i < 28; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const rw = 40 + rnd() * 90;
    const rh = 28 + rnd() * 70;
    const g = 108 + Math.floor(rnd() * 36);
    ctx.fillStyle = `rgba(${g - 8},${g},${g + 4},0.28)`;
    ctx.beginPath();
    ctx.moveTo(x + rw, y);
    ctx.quadraticCurveTo(x + rw, y + rh, x, y + rh);
    ctx.quadraticCurveTo(x - rw, y + rh, x - rw, y);
    ctx.quadraticCurveTo(x - rw, y - rh, x, y - rh);
    ctx.quadraticCurveTo(x + rw, y - rh, x + rw, y);
    ctx.closePath();
    ctx.fill();
  }
  // Black grain / hairline veins
  for (let i = 0; i < 18; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 6 + Math.floor(rnd() * 6);
    for (let s = 0; s < segs; s++) {
      x += (rnd() - 0.45) * 90;
      y += (rnd() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(8,8,10,${0.55 + rnd() * 0.35})`;
    ctx.lineWidth = 1.2 + rnd() * 2.4;
    ctx.stroke();
  }
  // Dark grout / joint lines, slightly irregular grid
  ctx.strokeStyle = 'rgba(6,6,8,0.82)';
  ctx.lineWidth = 2.4;
  for (let i = 1; i < 8; i++) {
    const x = (i * size) / 8 + (rnd() - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 16, size);
    ctx.stroke();
    const y = (i * size) / 8 + (rnd() - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rnd() - 0.5) * 16);
    ctx.stroke();
  }
  tex.update(false);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 3;
  tex.vScale = 3;
  tex.anisotropicFilteringLevel = 4;
  const mat = new PBRMaterial('bridge-grey-stone', scene);
  mat.albedoColor = new Color3(0.72, 0.74, 0.73);
  mat.albedoTexture = tex;
  mat.roughness = 0.92;
  mat.metallic = 0;
  mat.environmentIntensity = 0.12;
  mat.specularIntensity = 0.12;
  return mat;
}


const PALETTE_SKIP =
  /sky|sea|ql-land|ql-sea|ql-beach|ql-farm|ql-battle|char:|\/player|tripo-|meshy-|bridge-|lantern-paper|title-haze|tuft|verge|hem|sleeve|robe|head|iris|brow|eye/i;
const PROP_GLAZE =
  /altar|tea|desk|ink|scroll|chest|throne|incense|lantern|peony|stool|bench|guqin|cushion|parasol|cauldron|brazier|bell|drum|brush|inkstone/i;

/**
 * Assign unique per-role materials so shared pack `stone` / `plaster` / `glaze`
 * can read as 汉白玉, 红墙 and 黃琉璃 at a few metres, not one ochre wash.
 * Does not touch the grey-veined bridge material.
 */
export function applyPalacePalette(scene: Scene): void {
  const mats = palacePaletteMaterials(scene);
  for (const mesh of scene.meshes) {
    if (!mesh.isEnabled() || mesh.isDisposed()) continue;
    const matName = (mesh.material?.name ?? '').toLowerCase();
    const label = `${mesh.name} ${mesh.parent?.name ?? ''} ${matName}`;
    if (PALETTE_SKIP.test(label)) continue;
    if (matName.startsWith('bridge-') || matName.startsWith('palette-') || matName.startsWith('pave-') || matName === 'paving-cobble') {
      continue;
    }

    if (matName.includes('plaster')) {
      mesh.material = mats.vermilion;
      continue;
    }
    if (matName.includes('glaze')) {
      if (!PROP_GLAZE.test(label)) mesh.material = mats.yellowRoof;
      continue;
    }
    if (/roof-cassette|roof-ridge|dragon-roof-finial|roof-finial/.test(label) && (matName.includes('glaze') || !/timber|wood|bronze/.test(matName))) {
      if (matName.includes('glaze')) mesh.material = mats.yellowRoof;
      continue;
    }
    if (matName.includes('lacquer')) {
      mesh.material = mats.lacquer;
      continue;
    }
    if (matName.includes('timber') || /(^|\/|_)wood$/.test(matName) || matName === 'wood') {
      mesh.material = mats.darkWood;
      continue;
    }
    if (matName.includes('stone') || matName.includes('paving') || matName.includes('plaster')) {
      if (/paving|pave-|hall-floor|flagstone/.test(label)) {
        mesh.material = mats.greyBrick;
      } else if (/rockery|scholars-stone/.test(label)) {
        mesh.material = mats.rockGrey;
      } else if (/arched-stone-bridge|coast-bridge|stone-bridge/.test(label)) {
        continue;
      } else {
        // Wall bases, terraces, steps, rails, pond rims, hall/gate plinths: 汉白玉.
        mesh.material = mats.marble;
      }
    }
  }
}

function palacePaletteMaterials(scene: Scene): {
  vermilion: PBRMaterial;
  yellowRoof: PBRMaterial;
  marble: PBRMaterial;
  greyBrick: PBRMaterial;
  darkWood: PBRMaterial;
  lacquer: PBRMaterial;
  rockGrey: PBRMaterial;
} {
  const take = (name: string, hex: Color3, roughness: number, metallic = 0, env = 0.2) => {
    const hit = scene.getMaterialByName(name);
    if (hit instanceof PBRMaterial) return hit;
    const m = new PBRMaterial(name, scene);
    m.albedoColor = hex;
    m.roughness = roughness;
    m.metallic = metallic;
    m.environmentIntensity = env;
    m.specularIntensity = metallic > 0 ? 0.35 : 0.14;
    return m;
  };
  return {
    vermilion: take('palette-vermilion', new Color3(0.62, 0.15, 0.11), 0.62, 0, 0.16),
    yellowRoof: take('palette-yellow-roof', new Color3(0.84, 0.6, 0.1), 0.36, 0.14, 0.28),
    marble: take('palette-marble', new Color3(0.8, 0.81, 0.83), 0.72, 0, 0.2),
    greyBrick: take('palette-grey-brick', new Color3(0.62, 0.65, 0.68), 0.88, 0, 0.14),
    darkWood: take('palette-dark-wood', new Color3(0.26, 0.15, 0.09), 0.7, 0, 0.12),
    lacquer: take('palette-lacquer', new Color3(0.7, 0.11, 0.09), 0.38, 0.04, 0.2),
    rockGrey: take('palette-rock-grey', new Color3(0.46, 0.49, 0.47), 0.86, 0, 0.14)
  };
}
