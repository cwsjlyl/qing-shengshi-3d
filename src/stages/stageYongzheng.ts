import {
  Color3,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { attachToWorld, buildCharacter } from '../characters/buildCharacter';
import { WalkGrid } from '../engine/collision';
import { applyYongzhengWalk } from './walkLayouts';
import { DIALOGUE } from '../data/content';
import { clearMaterialCaches, hexColor, stdMat } from '../engine/materials';
import { addSkyDome, addWarmPalaceLights, enrichImportedMaterials, finalizeShadows } from '../engine/sceneSetup';
import { clearModelCache, disposePlaced, freezeStatic, MODEL, placeModel, type PlacedModel } from '../engine/loadModel';
import type { Input } from '../engine/input';
import type { Joystick } from '../ui/joystick';
import type { HUD } from '../ui/hud';
import { createPlayer } from '../player/player';
import { buildExitMarker, buildGoldIngots, buildHallFloor } from '../props/props';
import { dressYongzhengPack } from '../props/packDetail';
import { applyPalacePalette } from '../props/dressPalace';
import { npcInteractable, pointInteractable } from './helpers';
import type { StageHandle } from './types';
import { rect, type MinimapSchema } from '../ui/minimap';

export async function loadYongzhengStage(
  scene: Scene,
  canvas: HTMLCanvasElement,
  input: Input,
  joystick: Joystick,
  hud: HUD,
  onProgress?: (p: number, msg: string) => void
): Promise<StageHandle> {
  onProgress?.(0.05, '正在載入雍正大殿……');
  addSkyDome(scene, '#3E86D0', '#C0D8EE', 280);
  const { shadows } = addWarmPalaceLights(scene);
  scene.fogColor = hexColor('#B8C6D2');
  scene.fogStart = 42;
  scene.fogEnd = 120;

  const placed: PlacedModel[] = [];
  const put = async (
    url: string,
    name: string,
    x: number,
    z: number,
    rotY = 0,
    y = 0,
    scaling?: number
  ) => {
    const m = await placeModel(scene, url, {
      name,
      position: new Vector3(x, y, z),
      rotationY: rotY,
      scaling
    });
    placed.push(m);
    freezeStatic(m.root);
    return m;
  };

  const floor = buildHallFloor(scene, 'hall-floor', 36, 40);

  const carpet = MeshBuilder.CreateBox('carpet', { width: 3.2, height: 0.03, depth: 22 }, scene);
  carpet.position.set(0, 0.02, 1);
  carpet.material = stdMat(scene, '#7A1515', { specular: 0.2 });
  carpet.isPickable = false;

  onProgress?.(0.15, '正在搭建大殿……');
  await put(MODEL.gate, 'yz-gate', 0, 16, Math.PI);
  await put(MODEL.hall, 'yz-hall', 0, -14, 0);

  onProgress?.(0.4, '正在擺放陳設……');
  const wallJobs: Promise<unknown>[] = [];
  for (const x of [-14, -10, -6, 6, 10, 14]) {
    wallJobs.push(put(MODEL.wallStraight, `wall-n-${x}`, x, -18, 0));
    wallJobs.push(put(MODEL.wallStraight, `wall-s-${x}`, x, 18, 0));
  }
  wallJobs.push(put(MODEL.moonGate, 'yz-exit-gate', 0, -18, 0));
  wallJobs.push(put(MODEL.wallEnd, 'yz-end-l', -3.2, -18, 0));
  wallJobs.push(put(MODEL.wallEnd, 'yz-end-r', 3.2, -18, Math.PI));
  for (let z = -14; z <= 14; z += 4) {
    wallJobs.push(put(MODEL.wallStraight, `wall-w-${z}`, -18, z, Math.PI / 2));
    wallJobs.push(put(MODEL.wallStraight, `wall-e-${z}`, 18, z, Math.PI / 2));
  }
  wallJobs.push(put(MODEL.wallCorner, 'wc-nw', -18, -18, Math.PI / 2));
  wallJobs.push(put(MODEL.wallCorner, 'wc-ne', 18, -18, 0));
  wallJobs.push(put(MODEL.wallCorner, 'wc-sw', -18, 18, Math.PI));
  wallJobs.push(put(MODEL.wallCorner, 'wc-se', 18, 18, -Math.PI / 2));
  await Promise.all(wallJobs);

  await put(MODEL.terrace, 'dais-1', 0, -6, 0, -0.05);
  await put(MODEL.terrace, 'dais-2', 0, -8, 0, -0.05);
  // terrace-steps.glb slopes down along local +Z (high at local Z=-0.88,
  // low at +1.32). rotY=π used to point the high end toward the player.
  // Place at z=-3.77, rotY=0 so the high end sits under the dais (z≈-4.65)
  // and the low end meets the aisle in front of the officials (z≈-2.45).
  await put(MODEL.steps, 'dais-steps', 0, -3.77, 0, -0.05);
  await put(MODEL.throne, 'yz-throne', 0, -7.4, 0, 1.1);
  await put(MODEL.footstool, 'yz-foot', 0, -6.1, 0, 1.1);
  await put(MODEL.screen, 'yz-screen', 0, -9.1, Math.PI, 1.1);
  await put(MODEL.parasol, 'yz-parasol', -2.6, -7.6, 0, 1.1);
  await put(MODEL.incense, 'yz-incense', 2.4, -7.2, 0, 1.1);

  const decor: Promise<unknown>[] = [];
  for (const x of [-6, 6]) {
    for (const z of [-2, 4, 10]) {
      decor.push(put(MODEL.column, `col-${x}-${z}`, x, z));
      decor.push(put(MODEL.lanternHanging, `lan-${x}-${z}`, x + (x > 0 ? 0.6 : -0.6), z));
    }
  }
  decor.push(put(MODEL.cauldron, 'cao-l', -4.2, 8));
  decor.push(put(MODEL.cauldron, 'cao-r', 4.2, 8));
  decor.push(put(MODEL.banner, 'ban-l', -5.5, 16.4));
  decor.push(put(MODEL.banner, 'ban-r', 5.5, 16.4, Math.PI));
  decor.push(put(MODEL.lions, 'yz-lions', 0, 12.2));
  decor.push(put(MODEL.chest, 'chest-1', -9.2, -2.2, 0.4));
  decor.push(put(MODEL.chest, 'chest-2', -8.2, -3.4, -0.2));
  decor.push(put(MODEL.chest, 'chest-3', -10.0, -3.6, 0.8));
  decor.push(put(MODEL.altar, 'treasury-table', -9.0, -1.2, 0));
  await Promise.all(decor);
  onProgress?.(0.7, '正在布置殿內陳設……');
  placed.push(...(await dressYongzhengPack(scene)));
  const goldRoot = new TransformNode('gold', scene);
  goldRoot.position.set(-9.0, 0.85, -1.2);
  buildGoldIngots(scene, goldRoot, 10);

  const lamp = new PointLight('lantern-light', new Vector3(0, 5.5, -2), scene);
  lamp.intensity = 0.55;
  lamp.diffuse = new Color3(1, 0.82, 0.5);
  lamp.range = 22;

  onProgress?.(0.85, '正在布置人物……');

  const grid = new WalkGrid(0.42);
  applyYongzhengWalk(grid);

  // Standing in front of the throne on the dais (y=1.1). The GLB is a
  // standing pose, so we do not bend the legs to sit. Same facing and talk
  // target as before; interact radius unchanged.
  const yongzheng = attachToWorld(
    await buildCharacter(scene, { id: 'yongzheng', kind: 'yongzheng' }),
    0,
    1.1,
    -6.5,
    0
  );
  const officialA = attachToWorld(
    await buildCharacter(scene, { id: 'officialA', kind: 'official', variant: 0 }),
    -1.8,
    0,
    -2.1,
    Math.PI
  );
  officialA.root.rotation.x = 0.12;
  const officialB = attachToWorld(
    await buildCharacter(scene, { id: 'officialB', kind: 'official', variant: 1 }),
    1.9,
    0,
    -1.7,
    Math.PI
  );
  officialB.root.rotation.x = 0.18;
  const cower = attachToWorld(
    await buildCharacter(scene, { id: 'cower', kind: 'official', variant: 0, scale: 0.95 }),
    -7.2,
    0,
    -1.5,
    -Math.PI / 2
  );
  cower.root.rotation.x = 0.28;

  const treasuryPos = new Vector3(-9.0, 0, -2.4);
  const exitPos = new Vector3(0, 0, -16.6);
  const exit = buildExitMarker(scene, 'exit-yz');
  exit.position.copyFrom(exitPos);

  const interactables = [
    npcInteractable('yongzheng', '雍正皇帝', yongzheng, DIALOGUE.yongzheng, { radius: 2.6 }),
    npcInteractable('officialA', '貪官', officialA, DIALOGUE.officialA),
    npcInteractable('officialB', '貪官', officialB, DIALOGUE.officialB),
    pointInteractable('treasury', '國庫線索（吏治清明／充實國庫）', treasuryPos, DIALOGUE.treasury, {
      kind: 'investigate',
      radius: 2.8
    }),
    pointInteractable('door', '大殿出口', exitPos, [], { required: false, kind: 'door', radius: 2.3 })
  ];

  // On the red carpet, looking up the aisle at the emperor and officials.
  const player = await createPlayer(scene, canvas, input, joystick, hud, grid, {
    x: 0,
    z: 2.0,
    facing: Math.PI
  }, 3.8);


  const minimap: MinimapSchema = {
    bounds: { minX: -19.5, maxX: 19.5, minZ: -19.5, maxZ: 19.5 },
    rects: [
      rect(-19.2, -17.2, -19.2, 19.2),
      rect(17.2, 19.2, -19.2, 19.2),
      rect(-19.2, -4.0, 17.2, 19.2),
      rect(4.0, 19.2, 17.2, 19.2),
      rect(-19.2, -2.4, -19.2, -17.2),
      rect(2.4, 19.2, -19.2, -17.2),
      rect(-4.2, -1.15, 14.6, 18.4),
      rect(1.15, 4.2, 14.6, 18.4),
      rect(-5.4, 5.4, -17.2, -10.2),
      rect(-2.05, 2.05, -10.0, -4.0, 'platform'),
      rect(-2.25, 2.25, -4.25, -2.25, 'platform')
    ],
    items: [
      { x: -9.0, z: -2.4 },
      { x: -9.0, z: -1.2 },
      { x: 8.5, z: 1.0 },
      { x: 0, z: -16.6, kind: 'exit' }
    ]
  };

  enrichImportedMaterials(scene);
  applyPalacePalette(scene);
  finalizeShadows(scene, shadows);
  onProgress?.(1, '準備就緒');

  const dispose = () => {
    yongzheng.dispose();
    officialA.dispose();
    officialB.dispose();
    cower.dispose();
    exit.dispose();
    player.dispose();
    goldRoot.dispose();
    lamp.dispose();
    floor.dispose();
    carpet.dispose();
    disposePlaced(placed);
    clearModelCache();
    clearMaterialCaches();
  };

  return {
    scene,
    grid,
    player,
    interactables,
    requiredIds: ['yongzheng', 'officialA', 'officialB', 'treasury'],
    quizReady: false,
    quizDone: false,
    passwordDone: false,
    strengthAt: () => ({ value: 0.88, kind: 'strong' }),
    minimap,
    dispose
  };
}
