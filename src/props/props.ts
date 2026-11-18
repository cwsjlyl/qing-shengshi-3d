import {
  Color3,
  FresnelParameters,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  VertexBuffer
} from '@babylonjs/core';
import { hexColor, stdMat, PALETTE } from '../engine/materials';

export function buildGoldIngots(scene: Scene, parent: TransformNode, count = 8): void {
  const gold = stdMat(scene, PALETTE.goldBright, { specular: 0.65, emissive: 0.12 });
  for (let i = 0; i < count; i++) {
    const ingot = MeshBuilder.CreateCylinder(
      `ingot${i}`,
      { height: 0.1, diameterTop: 0.16, diameterBottom: 0.22, tessellation: 6 },
      scene
    );
    ingot.parent = parent;
    ingot.material = gold;
    ingot.position.set((i % 3) * 0.2 - 0.2, 0.08 + Math.floor(i / 3) * 0.1, (i % 2) * 0.16 - 0.08);
    ingot.rotation.y = i * 0.4;
    ingot.isPickable = false;
  }
}

export function buildCrackedField(scene: Scene, name: string, width: number, depth: number): Mesh {
  const ground = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 24 }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const dry = hexColor('#8A6A40');
  const crack = hexColor('#3A2A18');
  const dust = hexColor('#C4A06A');
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    // subtle height roughness + crack lines
    const n = Math.sin(x * 1.7) * Math.cos(z * 1.3) * 0.08 + Math.sin(x * 0.4 + z * 0.2) * 0.05;
    positions[i + 1] = n;
    const crackLine =
      Math.abs(Math.sin(x * 0.9) + Math.cos(z * 1.1)) < 0.12 ||
      Math.abs(Math.sin(z * 0.7) * Math.cos(x * 0.5)) < 0.08;
    const c = crackLine ? crack : n > 0.05 ? dust : dry;
    colors.push(c.r, c.g, c.b, 1);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.setVerticesData(VertexBuffer.ColorKind, colors);
  ground.refreshBoundingInfo();
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.05, 0.05, 0.04);
  mat.diffuseColor = Color3.White();
  mat.freeze();
  ground.material = mat;
  ground.useVertexColors = true;
  ground.isPickable = false;
  return ground;
}

export function buildLandGround(
  scene: Scene,
  name: string,
  width: number,
  depth: number,
  opts: { centerX?: number; centerZ?: number; moundX?: number; moundZ?: number } = {}
): Mesh {
  const ground = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 28 }, scene);
  ground.position.set(opts.centerX ?? 0, 0, opts.centerZ ?? 0);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const grass = hexColor('#3E8A3A');
  const grassDeep = hexColor('#2E6B2C');
  const dry = hexColor('#8A7A40');
  const dirt = hexColor('#6A5230');
  const mx = opts.moundX ?? 0;
  const mz = opts.moundZ ?? 36;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const wx = x + (opts.centerX ?? 0);
    const wz = z + (opts.centerZ ?? 0);
    const mound = Math.max(0, 1 - Math.hypot(wx - mx, wz - mz) / 14);
    const h =
      Math.sin(wx * 0.09) * 0.06 +
      Math.cos(wz * 0.07) * 0.05 +
      Math.sin(wx * 0.28 + wz * 0.22) * 0.03 +
      mound * mound * 0.22;
    positions[i + 1] = h;
    const path = Math.abs(wx) < 2.4 && wz > 8 && wz < 34;
    let c = grass;
    if (path) c = dirt;
    else if (mound > 0.25) c = Color3.Lerp(grass, dirt, mound * 0.7);
    else if ((Math.sin(wx * 0.3) + Math.cos(wz * 0.25)) * 0.5 < -0.15) c = grassDeep;
    else if (h < 0.05 && Math.abs(wx) > 8) c = dry;
    colors.push(c.r, c.g, c.b, 1);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.setVerticesData(VertexBuffer.ColorKind, colors);
  ground.createNormals(false);
  ground.refreshBoundingInfo();
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.05, 0.06, 0.03);
  mat.diffuseColor = Color3.White();
  mat.freeze();
  ground.material = mat;
  ground.useVertexColors = true;
  ground.isPickable = false;
  return ground;
}

export function buildBeach(scene: Scene, name: string, width: number, depth: number, x: number, z: number): Mesh {
  const beach = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 8 }, scene);
  beach.position.set(x, 0.02, z);
  const positions = beach.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const sand = hexColor('#C8B07A');
  const wet = hexColor('#8A7A52');
  for (let i = 0; i < positions.length; i += 3) {
    const lx = positions[i];
    const c = lx > 0.4 ? wet : sand;
    colors.push(c.r, c.g, c.b, 1);
    positions[i + 1] = lx * 0.04;
  }
  beach.updateVerticesData(VertexBuffer.PositionKind, positions);
  beach.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.08, 0.07, 0.04);
  mat.diffuseColor = Color3.White();
  mat.freeze();
  beach.material = mat;
  beach.useVertexColors = true;
  beach.isPickable = false;
  return beach;
}

export function buildBattlePatch(scene: Scene, name: string, x: number, z: number): Mesh {
  const patch = MeshBuilder.CreateGround(name, { width: 18, height: 16, subdivisions: 10 }, scene);
  patch.position.set(x, 0.06, z);
  const positions = patch.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const dirt = hexColor('#6B5230');
  const dust = hexColor('#8A6E3E');
  const trample = hexColor('#4A3820');
  for (let i = 0; i < positions.length; i += 3) {
    const px = positions[i];
    const pz = positions[i + 2];
    const n = Math.sin(px * 1.4) * Math.cos(pz * 1.1) * 0.05;
    positions[i + 1] = n;
    const c = Math.abs(Math.sin(px * 0.8 + pz * 0.5)) < 0.2 ? trample : n > 0 ? dust : dirt;
    colors.push(c.r, c.g, c.b, 1);
  }
  patch.updateVerticesData(VertexBuffer.PositionKind, positions);
  patch.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.04, 0.04, 0.03);
  mat.diffuseColor = Color3.White();
  mat.freeze();
  patch.material = mat;
  patch.useVertexColors = true;
  patch.isPickable = false;
  return patch;
}

export function buildSea(
  scene: Scene,
  name: string,
  width: number,
  depth: number,
  opts: { centerX?: number; centerZ?: number; y?: number; shoreX?: number } = {}
): Mesh {
  const sea = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 36 }, scene);
  const cx = opts.centerX ?? 0;
  const cz = opts.centerZ ?? 0;
  const y0 = opts.y ?? -0.22;
  const shoreX = opts.shoreX ?? 17;
  sea.position.set(cx, y0, cz);
  const positions = sea.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const deep = hexColor('#1788A8');
  const mid = hexColor('#2EB8C8');
  const shallow = hexColor('#6FDED4');
  const foam = hexColor('#D8F6F2');
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const wx = x + cx;
    const h = Math.sin(x * 0.16) * Math.cos(z * 0.14) * 0.1;
    positions[i + 1] = h;
    const distShore = wx - shoreX;
    let c = deep;
    if (distShore < 5) c = Color3.Lerp(shallow, mid, Math.max(0, distShore / 5));
    else if (distShore < 16) c = Color3.Lerp(mid, deep, (distShore - 5) / 11);
    const foamRipple = Math.abs(Math.sin(z * 0.35) + Math.cos(x * 0.5)) < 0.12 && distShore < 4;
    if (foamRipple || distShore < 1.2) c = Color3.Lerp(c, foam, distShore < 1.2 ? 0.55 : 0.35);
    colors.push(c.r, c.g, c.b, 1);
  }
  sea.updateVerticesData(VertexBuffer.PositionKind, positions);
  sea.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.74, 0.86, 0.92);
  mat.specularPower = 80;
  mat.diffuseColor = Color3.White();
  mat.alpha = 0.96;
  if (scene.environmentTexture) {
    const refl = scene.environmentTexture.clone();
    if (refl) {
      refl.coordinatesMode = Texture.SKYBOX_MODE;
      mat.reflectionTexture = refl;
      const fres = new FresnelParameters();
      fres.bias = 0.1;
      fres.power = 1.85;
      fres.leftColor = new Color3(0.72, 0.88, 0.94);
      fres.rightColor = new Color3(0.05, 0.08, 0.09);
      mat.reflectionFresnelParameters = fres;
    }
  }
  sea.material = mat;
  sea.useVertexColors = true;
  sea.isPickable = false;
  sea.receiveShadows = true;
  return sea;
}

export function buildHallFloor(scene: Scene, name: string, width: number, depth: number): Mesh {
  const floor = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 20 }, scene);
  const positions = floor.getVerticesData(VertexBuffer.PositionKind)!;
  const colors: number[] = [];
  const a = hexColor('#8A9198');
  const b = hexColor('#6E767E');
  const inlay = hexColor('#A8B0B6');
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const tile = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0;
    const edge = Math.abs(x) < 1.8;
    const c = edge ? inlay : tile ? a : b;
    colors.push(c.r, c.g, c.b, 1);
  }
  floor.setVerticesData(VertexBuffer.ColorKind, colors);
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.specularColor = new Color3(0.1, 0.11, 0.12);
  mat.specularPower = 32;
  mat.diffuseColor = Color3.White();
  mat.freeze();
  floor.material = mat;
  floor.useVertexColors = true;
  floor.isPickable = false;
  floor.receiveShadows = true;
  return floor;
}

export function animateSea(mesh: Mesh, t: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return;
  // Only a gentle wave on y; we stored original xz, recompute y from xz + time
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    positions[i + 1] = Math.sin(x * 0.18 + t * 0.8) * Math.cos(z * 0.16 + t * 0.6) * 0.14;
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions, false, false);
}

export function buildDock(scene: Scene, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  const wood = stdMat(scene, '#6B4A2A', { specular: 0.1 });
  const plank = MeshBuilder.CreateBox('plank', { width: 4.2, height: 0.18, depth: 10 }, scene);
  addMesh(plank, root, wood, 0, 0.2, 0);
  for (const z of [-4, 0, 4]) {
    for (const x of [-1.8, 1.8]) {
      const pile = MeshBuilder.CreateCylinder(`pile${x}${z}`, { height: 1.4, diameter: 0.22, tessellation: 6 }, scene);
      addMesh(pile, root, wood, x, -0.3, z);
    }
  }
  const postL = MeshBuilder.CreateBox('postL', { width: 0.12, height: 0.7, depth: 9.2 }, scene);
  addMesh(postL, root, stdMat(scene, PALETTE.gold, { specular: 0.3 }), -2.0, 0.5, 0);
  const postR = postL.clone('postR')!;
  postR.parent = root;
  postR.position.x = 2.0;
  return root;
}

function addMesh(mesh: Mesh, parent: TransformNode, mat: StandardMaterial, x: number, y: number, z: number): void {
  mesh.parent = parent;
  mesh.material = mat;
  mesh.position.set(x, y, z);
  mesh.isPickable = false;
}

export function buildExitMarker(scene: Scene, name: string): TransformNode {
  const root = new TransformNode(name, scene);
  const gold = stdMat(scene, PALETTE.goldBright, { specular: 0.4, emissive: 0.2 });
  const red = stdMat(scene, '#8B1A1A', { specular: 0.2, emissive: 0.05 });
  const postL = MeshBuilder.CreateBox('pL', { width: 0.16, height: 2.4, depth: 0.16 }, scene);
  addMesh(postL, root, gold, -1.1, 1.2, 0);
  const postR = postL.clone('pR')!;
  postR.parent = root;
  postR.position.x = 1.1;
  const lintel = MeshBuilder.CreateBox('lintel', { width: 2.5, height: 0.22, depth: 0.2 }, scene);
  addMesh(lintel, root, gold, 0, 2.4, 0);
  const plaque = MeshBuilder.CreateBox('plaque', { width: 1.2, height: 0.4, depth: 0.08 }, scene);
  addMesh(plaque, root, red, 0, 2.15, 0.06);
  return root;
}
