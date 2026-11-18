import { Color3, Mesh, Scene, Vector3 } from '@babylonjs/core';
import { attachToWorld, buildCharacter, type Character } from '../characters/buildCharacter';
import { WalkGrid } from '../engine/collision';
import { DIALOGUE } from '../data/content';
import { clearMaterialCaches, hexColor } from '../engine/materials';
import { addSkyDome, addWarmPalaceLights, enrichImportedMaterials, finalizeShadows } from '../engine/sceneSetup';
import { clearModelCache, disposePlaced, freezeStatic, MODEL, placeModel, placePack, type PlacedModel } from '../engine/loadModel';
import type { Input } from '../engine/input';
import type { Joystick } from '../ui/joystick';
import type { HUD } from '../ui/hud';
import { createPlayer } from '../player/player';
import {
  animateSea,
  buildBeach,
  buildBattlePatch,
  buildCrackedField,
  buildDock,
  buildGoldIngots,
  buildLandGround,
  buildSea
} from '../props/props';
import { applyPalacePalette, dressFarmland, retintStoneBridges, tameStandingLanterns } from '../props/dressPalace';
import { protectDistantPavilions } from '../props/packDetail';
import { buildEscortJunk, buildImperialBarge, type Barge } from '../props/imperialBarge';
import { attachMeshyFlagshipVisual } from '../props/meshyFlagship';
import { npcInteractable, pointInteractable } from './helpers';
import type { StageHandle } from './types';
import { rect, type MinimapSchema } from '../ui/minimap';
import { TransformNode } from '@babylonjs/core';

export async function loadQianlongStage(
  scene: Scene,
  canvas: HTMLCanvasElement,
  input: Input,
  joystick: Joystick,
  hud: HUD,
  onProgress?: (p: number, msg: string) => void
): Promise<StageHandle> {
  onProgress?.(0.05, '正在載入乾隆戶外場景……');
  addSkyDome(scene, '#2F74C4', '#A8CCE8', 420);
  const { shadows } = addWarmPalaceLights(scene);
  scene.fogColor = hexColor('#9CBED4');
  scene.fogStart = 80;
  scene.fogEnd = 220;

  // Land ends at x≈18 so it never covers the sea. Sea starts at x=17.
  const land = buildLandGround(scene, 'ql-land', 58, 80, {
    centerX: -11,
    centerZ: 16,
    moundX: 0,
    moundZ: 36
  });
  const farm = buildCrackedField(scene, 'ql-farm', 28, 22);
  farm.position.set(-2, 0.05, -10);
  const beach = buildBeach(scene, 'ql-beach', 6, 80, 16.5, 6);
  const sea = buildSea(scene, 'ql-sea', 72, 80, {
    centerX: 53,
    centerZ: 6,
    y: -0.22,
    shoreX: 17
  });
  const battlePatch = buildBattlePatch(scene, 'ql-battle-patch', 0, 35.5);

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
  const batch = (jobs: Promise<unknown>[]) => Promise.all(jobs);

  onProgress?.(0.2, '正在布置準噶爾平亂……');
  // Battle / high point (north)
  await batch([
    put(MODEL.gate, 'battle-gate', 0, 41, Math.PI),
    put(MODEL.banner, 'b1', -5.2, 37.4),
    put(MODEL.banner, 'b2', 5.2, 37.4, Math.PI),
    put(MODEL.pennant, 'p1', -6.6, 35.6, 0.25),
    put(MODEL.pennant, 'p2', 6.6, 35.6, -0.25),
    put(MODEL.banner, 'b3', -3.6, 38.4, 0.15),
    put(MODEL.banner, 'b4', 3.6, 38.4, -0.15),
    put(MODEL.banner, 'b5', -7.4, 38.6, 0.4),
    put(MODEL.banner, 'b6', 7.4, 38.6, -0.4),
    put(MODEL.rack, 'rack1', -6.2, 34.2, 0.35),
    put(MODEL.rack, 'rack2', 6.2, 34.2, -0.35),
    put(MODEL.drum, 'drum', -2.8, 37.0),
    put(MODEL.rockery, 'rock-n1', -9.5, 37.2),
    put(MODEL.rockery, 'rock-n2', 9.8, 36.4, 0.8),
    put(MODEL.rockery, 'rock-n3', -8.2, 32.6, 0.4),
    put(MODEL.rockery, 'rock-n4', 8.6, 32.2, 1.1),
    put(MODEL.plum, 'plum-n', -11, 33.5),
    put(MODEL.parasol, 'ql-parasol', -2.2, 36.5)
  ]);

  onProgress?.(0.4, '正在布置和珅與農田……');
  // Heshen / late decline (west)
  await batch([
    put(MODEL.lotusPavilion, 'heshen-pav', -28, 10),
    put(MODEL.chest, 'h-chest1', -25.5, 11.2, 0.4),
    put(MODEL.chest, 'h-chest2', -25.0, 9.6, -0.5),
    put(MODEL.chest, 'h-chest3', -26.2, 8.8, 0.9),
    put(MODEL.screen, 'h-screen', -30.2, 10.5, Math.PI / 2),
    put(MODEL.lanternStanding, 'h-lan1', -24.5, 12.4),
    put(MODEL.lanternStanding, 'h-lan2', -24.5, 8.0),
    put(MODEL.bamboo, 'h-bam1', -32, 13),
    put(MODEL.bamboo, 'h-bam2', -32, 7)
  ]);
  const gold = new TransformNode('h-gold', scene);
  gold.position.set(-25.4, 0.9, 10.4);
  buildGoldIngots(scene, gold, 12);

  // Farm (south)
  await batch([
    put(MODEL.stone, 'farm-stone', 4, -14),
    put(MODEL.rockery, 'farm-rock', -8, -16, 0.4),
    put(MODEL.bamboo, 'farm-bam', 8, -12)
  ]);
  const farmDress = dressFarmland(scene, -2, -10);

  onProgress?.(0.6, '正在布置南巡船隊……');
  // Coast + pier
  await batch([
    put(MODEL.bridge, 'coast-bridge', 14, 18, Math.PI / 2, -0.2),
    put(MODEL.waterPavilion, 'coast-pav', 14, 14, -0.4, -0.1),
    put(MODEL.plum, 'coast-plum', 12, 18),
    put(MODEL.bamboo, 'coast-bam', 13, 3),
    put(MODEL.lanternStanding, 'dock-lan1', 18.6, 3.6),
    put(MODEL.lanternStanding, 'dock-lan2', 18.6, 0.6),
    put(MODEL.banner, 'dock-ban', 17.2, 4.4)
  ]);

  const dock = buildDock(scene, 'dock');
  // South of the flagship so the approach looks at the broadside on the water.
  dock.position.set(22, 0.05, 2.0);
  dock.rotation.y = Math.PI / 2;

  const barge: Barge = buildImperialBarge(scene, 'flagship', 1);
  // Length 28 along local Z; rotY = PI/2 puts the hull along X, bow toward the open sea.
  // Centre x=36 → west end ≈22, meeting the pier; clearly sitting on the water.
  barge.root.position.set(36, -0.12, 8);
  barge.root.rotation.y = Math.PI / 2;
  const escortA = buildEscortJunk(scene, 'escort-a', 0.58);
  escortA.position.set(42, -0.1, 16.5);
  escortA.rotation.y = Math.PI / 2 + 0.18;
  const escortB = buildEscortJunk(scene, 'escort-b', 0.52);
  escortB.position.set(44, -0.1, 0.5);
  escortB.rotation.y = Math.PI / 2 - 0.22;

  const meshyPlaced: PlacedModel[] = [];
  const meshyBoat = await attachMeshyFlagshipVisual(scene, barge);
  if (meshyBoat) meshyPlaced.push(meshyBoat);

  // Shore landmark — clear of the pier corridor and of 乾隆 / 和珅 dialogue.
  const shorePav = await placePack(scene, MODEL.meshyPavilion, {
    name: 'ql-meshy-pavilion',
    position: new Vector3(16.2, 0, 12.2),
    rotationY: -0.35,
    scaling: 4.2
  });
  freezeStatic(shorePav.root);
  meshyPlaced.push(shorePav);

  // Shore peonies (pretty side toward the path) and one stool near the pier approach.
  const face = (deg: number) => ((deg - 36) * Math.PI) / 180;
  const shorePeonyA = await placePack(scene, MODEL.meshyPeony, {
    name: 'meshy-peony-shore-0',
    position: new Vector3(15.2, 0, 9.6),
    rotationY: face(90),
    scaling: 0.5
  });
  freezeStatic(shorePeonyA.root);
  meshyPlaced.push(shorePeonyA);
  const shorePeonyB = await placePack(scene, MODEL.meshyPeony, {
    name: 'meshy-peony-shore-1',
    position: new Vector3(17.4, 0, 14.4),
    rotationY: face(140),
    scaling: 0.5
  });
  freezeStatic(shorePeonyB.root);
  meshyPlaced.push(shorePeonyB);
  const shoreStool = await placePack(scene, MODEL.meshyStool, {
    name: 'meshy-stool-pier',
    position: new Vector3(15.4, 0, 5.4),
    rotationY: 0.5,
    scaling: 0.36
  });
  freezeStatic(shoreStool.root);
  meshyPlaced.push(shoreStool);

  // A few flagstone modules on the shore approach; clear of the pier corridor
  // (x=18–24, z=6–10), the farm, and the stool / peony footprints.
  const shoreFlags: Array<[number, number, number]> = [
    [12.8, 4.6, 0],
    [14.0, 4.6, Math.PI],
    [13.4, 6.5, 0.15]
  ];
  for (let i = 0; i < shoreFlags.length; i++) {
    const [x, z, rot] = shoreFlags[i];
    const slab = await placePack(scene, MODEL.meshyFlagstones, {
      name: `meshy-flagstones-shore-${i}`,
      position: new Vector3(x, 0.015, z),
      rotationY: rot,
      scaling: 1
    });
    freezeStatic(slab.root);
    meshyPlaced.push(slab);
  }

  // Path dressing
  await batch([
    put(MODEL.lanternStanding, 'path-1', 0, 20),
    put(MODEL.lanternStanding, 'path-2', 0, 8),
    put(MODEL.lanternStanding, 'path-3', -12, 10),
    put(MODEL.bench, 'bench-1', 3, 18, 0.4),
    put(MODEL.bonsai, 'bonsai-1', 4.2, 19)
  ]);
  enrichImportedMaterials(scene);
    for (const p of placed) {
    if (/lan|path-[123]|dock-lan/.test(p.root.name)) tameStandingLanterns(p.root, 0.55);
  }

  onProgress?.(0.8, '正在布置人物……');

  const grid = new WalkGrid(0.45);
  grid.addSolid(-46, -44, -28, 52);
  grid.addSolid(-46, 18, 50, 52);
  grid.addSolid(-46, 18, -28, -26);
  // Water is not walkable except the pier corridor (x=18–24, z=6–10). After the password
  // the ship-end block is removed so the player can reach the hull.
  grid.addSolid(18.5, 90, -40, 0.15);
  grid.addSolid(18.5, 90, 4.25, 50);
  const shipBlock = { minX: 24.6, maxX: 90, minZ: 0.15, maxZ: 4.25 };
  grid.addSolid(shipBlock.minX, shipBlock.maxX, shipBlock.minZ, shipBlock.maxZ);
  grid.addSolid(-4.2, 4.2, 38.8, 44.0, 0, 12);
  grid.addSolid(-31.5, -24.8, 7.2, 13.2, 0, 8);
  // Meshy shore pavilion footprint (scale 4.2, xz radius ≈ 0.67).
  grid.addSolid(13.9, 18.5, 9.9, 14.5, 0, 9);
  const pr = 0.92 * 0.5 * 0.7;
  grid.addSolid(15.2 - pr, 15.2 + pr, 9.6 - pr, 9.6 + pr, 0, 1.8);
  grid.addSolid(17.4 - pr, 17.4 + pr, 14.4 - pr, 14.4 + pr, 0, 1.8);
  const sr = 0.9 * 0.36 * 0.75;
  grid.addSolid(15.4 - sr, 15.4 + sr, 5.4 - sr, 5.4 + sr, 0, 1.0);

  const chars: Character[] = [];
  const qianlong = attachToWorld(
    await buildCharacter(scene, { id: 'qianlong', kind: 'qianlong' }),
    0,
    0.12,
    36.4,
    Math.PI
  );
  chars.push(qianlong);
  // Tight formation around the emperor, facing the approaching student.
  const soldiers: Array<[number, number, number]> = [
    [-2.6, 34.5, Math.PI + 0.08],
    [2.6, 34.5, Math.PI - 0.08],
    [-4.2, 35.4, Math.PI + 0.2],
    [4.2, 35.4, Math.PI - 0.2],
    [-3.2, 37.2, Math.PI + 0.12],
    [3.2, 37.2, Math.PI - 0.12],
    [-5.4, 36.4, Math.PI + 0.35],
    [5.4, 36.4, Math.PI - 0.35]
  ];
  for (let i = 0; i < soldiers.length; i++) {
    const s = soldiers[i];
    chars.push(attachToWorld(await buildCharacter(scene, { id: `sol${i}`, kind: 'soldier', variant: i }), s[0], 0.12, s[1], s[2]));
  }

  const heshen = attachToWorld(
    await buildCharacter(scene, { id: 'heshen', kind: 'heshen', variant: 0, scale: 1.05 }),
    -25.6,
    0,
    10.2,
    1.2
  );
  chars.push(heshen);
  const briber = attachToWorld(
    await buildCharacter(scene, { id: 'briber', kind: 'official', variant: 1 }),
    -24.4,
    0,
    11.5,
    -2.1
  );
  chars.push(briber);

  const farmerA = attachToWorld(
    await buildCharacter(scene, { id: 'farmerA', kind: 'farmer', variant: 0 }),
    -1.5,
    0.06,
    -10.5,
    0.4
  );
  chars.push(farmerA);
  const farmerB = attachToWorld(
    await buildCharacter(scene, { id: 'farmerB', kind: 'farmer', variant: 1 }),
    1.8,
    0.06,
    -12.2,
    -0.6
  );
  chars.push(farmerB);

  const shipPos = new Vector3(22, 0, 2.2);
  const interactables = [
    npcInteractable('qianlong', '乾隆皇帝', qianlong, DIALOGUE.qianlong, { radius: 2.6 }),
    npcInteractable('soldier', '準噶爾平亂（清兵）', chars[1], DIALOGUE.soldier, { required: false, radius: 2.4 }),
    npcInteractable('heshen', '和珅', heshen, DIALOGUE.heshen, { radius: 2.5 }),
    npcInteractable('farmer', '農夫', farmerA, DIALOGUE.farmer, { radius: 2.6 }),
    pointInteractable('ships', '南巡船隊', shipPos, DIALOGUE.ships, { kind: 'investigate', radius: 3.4 }),
    pointInteractable('shipboard', '登上御船', new Vector3(24.2, 0, 3.2), [], {
      required: false,
      kind: 'ship',
      radius: 3.2
    })
  ];

  // Start already inside the 準噶爾 tableau, looking at the emperor and his troops.
  const player = await createPlayer(scene, canvas, input, joystick, hud, grid, {
    x: 0,
    y: 0.16,
    z: 31.2,
    facing: 0
  }, 5.4);

  enrichImportedMaterials(scene);
  retintStoneBridges(scene);
  applyPalacePalette(scene);
  protectDistantPavilions(scene);
  finalizeShadows(scene, shadows);
  onProgress?.(1, '準備就緒');

  const minimap: MinimapSchema = {
    bounds: { minX: -46, maxX: 48, minZ: -28, maxZ: 52 },
    rects: [
      rect(-46, -44, -28, 52),
      rect(-46, 18, 50, 52),
      rect(-46, 18, -28, -26),
      rect(18.5, 90, -40, 0.15, 'water'),
      rect(18.5, 90, 4.25, 50, 'water'),
      rect(-4.2, 4.2, 38.8, 44.0),
      rect(-31.5, -24.8, 7.2, 13.2),
      rect(13.9, 18.5, 9.9, 14.5),
      rect(18, 24.6, 0.15, 4.25, 'platform'),
      rect(24, 48, 0.5, 15.5)
    ],
    items: [
      { x: 22, z: 2.2 },
      { x: 15.4, z: 5.4 },
      { x: 14, z: 18 },
      { x: 24.2, z: 3.2, kind: 'exit' }
    ]
  };

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    animateSea(sea, t);
    escortA.position.y = -0.1 + Math.sin(t * 0.7 + 1.2) * 0.05;
    escortB.position.y = -0.1 + Math.sin(t * 0.6 + 0.4) * 0.05;
    barge.root.position.y = -0.15 + Math.sin(t * 0.55) * 0.04;
  };

  const strengthAt = (x: number, z: number) => {
    // Peak at the northern battle; weak in west (Heshen), south (farm) and east (ships).
    if (z >= 27 && x > -16 && x < 16) return { value: 1, kind: 'peak' as const };
    if (x < -16 || z < 2 || x > 14) return { value: 0.36, kind: 'weak' as const };
    return { value: 0.7, kind: 'strong' as const };
  };

  const dispose = () => {
    for (const c of chars) c.dispose();
    player.dispose();
    barge.root.dispose();
    escortA.dispose();
    escortB.dispose();
    dock.dispose();
    gold.dispose();
    land.dispose();
    farm.dispose();
    farmDress.dispose();
    beach.dispose();
    battlePatch.dispose();
    sea.dispose();
    disposePlaced(meshyPlaced);
    for (const p of placed) {
      try {
        p.container.dispose();
      } catch {
        /* ignore */
      }
    }
    clearModelCache();
    clearMaterialCaches();
  };

  return {
    scene,
    grid,
    player,
    interactables,
    requiredIds: ['qianlong', 'heshen', 'farmer', 'ships'],
    quizReady: false,
    quizDone: false,
    passwordDone: false,
    update,
    strengthAt,
    minimap,
    dispose
  };
}

export function unlockShipApproach(stage: StageHandle): void {
  // Drop the sea block that stopped the player short of the hull.
  stage.grid.solids = stage.grid.solids.filter((s) => !(s.minX === 24.6 && s.maxZ === 4.25));
}

export function getFlagship(scene: Scene): Mesh | TransformNode | null {
  return scene.getTransformNodeByName('flagship');
}

void Mesh;
