import { Color3, Scene, Vector3 } from '@babylonjs/core';
import { attachToWorld, buildCharacter } from '../characters/buildCharacter';
import { WalkGrid } from '../engine/collision';
import { applyKangxiWalk } from './walkLayouts';
import { DIALOGUE } from '../data/content';
import { clearMaterialCaches } from '../engine/materials';
import { addSkyDome, addWarmPalaceLights, enrichImportedMaterials, finalizeShadows } from '../engine/sceneSetup';
import { clearModelCache, disposePlaced, freezeStatic, MODEL, placeModel, type PlacedModel } from '../engine/loadModel';
import type { Input } from '../engine/input';
import type { Joystick } from '../ui/joystick';
import type { HUD } from '../ui/hud';
import { createPlayer } from '../player/player';
import { buildExitMarker } from '../props/props';
import { applyPalacePalette, dressCourtyard, retintStoneBridges } from '../props/dressPalace';
import { dressKangxiPack } from '../props/packDetail';
import { npcInteractable, pointInteractable } from './helpers';
import type { StageHandle } from './types';
import { rect, type MinimapSchema } from '../ui/minimap';

export async function loadKangxiStage(
  scene: Scene,
  canvas: HTMLCanvasElement,
  input: Input,
  joystick: Joystick,
  hud: HUD,
  onProgress?: (p: number, msg: string) => void
): Promise<StageHandle> {
  onProgress?.(0.05, '正在載入康熙庭院……');
  addSkyDome(scene, '#3A7FCB', '#B7D4EE', 280);
  const { shadows } = addWarmPalaceLights(scene);
  scene.fogColor = new Color3(0.7, 0.8, 0.88);
  scene.fogStart = 40;
  scene.fogEnd = 120;

  const placed: PlacedModel[] = [];
  const court = await placeModel(scene, MODEL.courtyard, {
    name: 'kangxi-courtyard',
    position: Vector3.Zero()
  });
  placed.push(court);
  enrichImportedMaterials(scene);
  dressCourtyard(scene, court.root);
  freezeStatic(court.root);
  onProgress?.(0.55, '正在布置庭院細節……');
  placed.push(...(await dressKangxiPack(scene)));
  enrichImportedMaterials(scene);
  retintStoneBridges(scene);
  applyPalacePalette(scene);
  onProgress?.(0.7, '正在布置人物……');

  const grid = new WalkGrid(0.42);
  applyKangxiWalk(grid);

  const chars = [
    // Standing on the dais, just south of the throne (same facing). The GLB
    // is a standing pose, so we do not bend the legs to sit.
    attachToWorld(
      await buildCharacter(scene, { id: 'kangxi', kind: 'kangxi' }),
      -10,
      1.1,
      5.8,
      Math.PI
    ),
    attachToWorld(await buildCharacter(scene, { id: 'manchu', kind: 'manchu' }), -7.5, 0, 8.35, Math.PI - 0.35),
    attachToWorld(await buildCharacter(scene, { id: 'han', kind: 'han' }), 12.15, 0, 0.15, -Math.PI / 2)
  ];

  const exitPos = new Vector3(0, 0, -3.35);
  const exit = buildExitMarker(scene, 'exit-kangxi');
  exit.position.copyFrom(exitPos);
  exit.rotation.y = Math.PI;

  const interactables = [
    npcInteractable('kangxi', '康熙皇帝', chars[0], DIALOGUE.kangxi, { radius: 2.5 }),
    npcInteractable('manchu', '滿族人', chars[1], DIALOGUE.manchu),
    npcInteractable('han', '漢族人', chars[2], DIALOGUE.han),
    pointInteractable('door', '庭院出口', exitPos, [], { required: false, kind: 'door', radius: 2.2 })
  ];

  // Stand on the east side of the central path, looking toward the hall (and the throne to the west).
  const player = await createPlayer(scene, canvas, input, joystick, hud, grid, {
    x: -3.2,
    z: 3.0,
    facing: Math.PI - 0.32
  }, 3.8);


  const minimap: MinimapSchema = {
    bounds: { minX: -15.5, maxX: 15.5, minZ: -15.5, maxZ: 15.5 },
    rects: [
      rect(-15.2, -13.2, -15.2, 15.2),
      rect(13.2, 15.2, -15.2, 15.2),
      rect(-15.2, 15.2, -15.2, -13.2),
      rect(-15.2, -5.4, 13.2, 15.2),
      rect(5.4, 15.2, 13.2, 15.2),
      rect(-4.2, -1.15, 11.5, 15.0),
      rect(1.15, 4.2, 11.5, 15.0),
      rect(-7.55, 7.55, -13.5, -1.15),
      rect(-11.93, -8.07, 5.07, 12.93, 'platform'),
      rect(-8.07, -5.5, 8.75, 13.25, 'platform'),
      rect(-8.00, -6.20, 0.30, 5.12, 'water'),
      rect(-0.20, 0.02, 0.30, 5.12, 'water'),
      rect(-8.20, 0.20, 5.12, 8.08, 'platform'),
      rect(6.45, 9.75, 4.74, 7.16),
      rect(-10.65, -7.95, -9.20, -5.58),
      rect(9.0, 9.6, -3.0, -0.6),
      rect(10.7, 12.3, -9.0, -7.4)
    ],
    items: [
      { x: 7.2, z: -0.6 },
      { x: 10.2, z: -6.2 },
      { x: 6.0, z: -4.4 },
      { x: 9.3, z: -1.8 },
      { x: 0, z: -3.35, kind: 'exit' }
    ]
  };

  finalizeShadows(scene, shadows);
  onProgress?.(1, '準備就緒');

  const dispose = () => {
    for (const c of chars) c.dispose();
    exit.dispose();
    player.dispose();
    disposePlaced(placed);
    clearModelCache();
    clearMaterialCaches();
  };

  return {
    scene,
    grid,
    player,
    interactables,
    requiredIds: ['kangxi', 'manchu', 'han'],
    quizReady: false,
    quizDone: false,
    passwordDone: false,
    strengthAt: () => ({ value: 0.78, kind: 'strong' as const }),
    minimap,
    dispose
  };
}
