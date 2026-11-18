import { Color3, Scene, Vector3 } from '@babylonjs/core';
import { attachToWorld, buildCharacter } from '../characters/buildCharacter';
import { WalkGrid } from '../engine/collision';
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
import { dressKangxiPack, MESHY_COURT } from '../props/packDetail';
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
  // Outer walls (gate gap around x=[-5.4, 5.4], z=14)
  grid.addSolid(-15.2, -13.2, -15.2, 15.2);
  grid.addSolid(13.2, 15.2, -15.2, 15.2);
  grid.addSolid(-15.2, 15.2, -15.2, -13.2);
  grid.addSolid(-15.2, -5.4, 13.2, 15.2);
  grid.addSolid(5.4, 15.2, 13.2, 15.2);
  // Gate tower piers, leave a central passage
  grid.addSolid(-4.2, -1.15, 11.5, 15.0, 0, 11);
  grid.addSolid(1.15, 4.2, 11.5, 15.0, 0, 11);
  // Ceremonial hall interior. Front central stairs are decorative and
  // lead into this solid, so they stay at ground height (no ramp) to
  // avoid trapping the player on the 台基.
  grid.addSolid(-5.2, 5.2, -13.2, -4.15, 0, 13);
  // Raised 台基 wings / cheeks (measured base X[-7.57,7.57] Z[-13.57,-1.10]),
  // leaving a central stair gap around |x|<2.2. Does not extend onto the
  // empty cobble north of z≈-1.1 (stool at 7.2,-0.6 stays clear).
  grid.addSolid(-7.55, -5.2, -13.2, -1.15, 0, 2.2);
  grid.addSolid(5.2, 7.55, -13.2, -1.15, 0, 2.2);
  grid.addSolid(-5.2, -2.2, -4.15, -1.15, 0, 2.2);
  grid.addSolid(2.2, 5.2, -4.15, -1.15, 0, 2.2);
  // Lotus pond, with a bridge gap near x=-4, z=6.2–8.3
  grid.addSolid(-8.35, -4.5, -0.35, 6.15);
  grid.addSolid(-2.0, 0.35, -0.35, 6.15);
  grid.addSolid(-8.35, -4.75, 6.15, 8.4);
  grid.addSolid(-2.0, 0.35, 6.15, 8.4);
  // Actual remaining rockery outcrop (measured Babylon AABB
  // X[6.490, 9.708] Z[4.782, 7.124]). The previous second box
  // (1.2, 8.6, 0.2, 7.8) was leftover after the visual rockery was
  // reduced and blocked a large stretch of empty east-courtyard cobble.
  grid.addSolid(6.45, 9.75, 4.74, 7.16, 0, 3.0);
  // Well + the bamboo clump beside it (measured well X[-10.53,-8.04]
  // Z[-7.30,-5.70]; bamboo X[-10.29,-8.56] Z[-9.06,-6.96]). Tightened
  // off the surrounding cobble.
  grid.addSolid(-10.65, -7.95, -9.20, -5.58, 0, 3.0);

  // Meshy moon-gate wall wings (opening stays walkable) and pavilion footprint.
  const gate = MESHY_COURT.moonGate;
  const gateHalfW = 0.949 * gate.scale;
  const gateHalfT = 0.239 * gate.scale;
  const opening = 1.15;
  // rotY = π/2: wall runs along Z, thickness along X.
  grid.addSolid(gate.x - gateHalfT - 0.1, gate.x + gateHalfT + 0.1, gate.z - gateHalfW, gate.z - opening, 0, 6.5);
  grid.addSolid(gate.x - gateHalfT - 0.1, gate.x + gateHalfT + 0.1, gate.z + opening, gate.z + gateHalfW, 0, 6.5);
  const pav = MESHY_COURT.pavilion;
  const pavR = 0.67 * pav.scale * 0.85;
  grid.addSolid(pav.x - pavR, pav.x + pavR, pav.z - pavR, pav.z + pavR, 0, 7.5);
  // Meshy peony pots (~scale 0.42–0.5, xz radius ≈ 0.92) and drum stools (~scale 0.36).
  const peonySolids: Array<[number, number, number]> = [
    [-5.85, 0.4, 0.42],
    [-6.05, -3.9, 0.42],
    [2.15, -2.8, 0.42],
    [2.35, -5.6, 0.42],
    [6.4, -2.2, 0.45],
    [7.6, -4.8, 0.48],
    [10.4, -5.0, 0.5],
    [9.6, -8.6, 0.5],
    [4.8, 8.4, 0.42],
    [6.4, 10.6, 0.42]
  ];
  for (const [x, z, s] of peonySolids) {
    const r = 0.92 * s * 0.7;
    grid.addSolid(x - r, x + r, z - r, z + r, 0, 1.8);
  }
  const stoolSolids: Array<[number, number]> = [
    [7.2, -0.6],
    [10.2, -6.2],
    [6.0, -4.4]
  ];
  for (const [x, z] of stoolSolids) {
    const r = 0.9 * 0.36 * 0.75;
    grid.addSolid(x - r, x + r, z - r, z + r, 0, 1.0);
  }

  // West throne terrace: two pack modules at (-10, 7) and (-10, 11). Collision
  // covers only the walkable top (y=1.1), not the skirt or the courtyard
  // south of z≈5.07. East step-flight is a ramp, not a flat 1.1 slab.
  grid.addPlatform(-11.93, -8.07, 5.07, 12.93, 1.1);
  // Roofs / walkway eaves: block the camera but not the player.
  grid.addCameraSolid(-14.4, -11.6, -8.5, 2.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -12.5, 9.5, 2.5, 7.5);
  grid.addCameraSolid(-13.5, -7.4, 4.6, 13.4, 3.2, 8.0);
  grid.addCameraSolid(-14.4, -11.6, 2.0, 6.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -6.5, -1.5, 2.5, 7.5);

  // East step-flight measured X[-8.000,-5.800] Z[8.900,13.100], high at
  // the west (platform) end, low at the east. Slightly widened on the
  // approach and sides so the player centre can enter the volume; height
  // is also sampled under the feet (ramps only).
  grid.addRamp({
    minX: -8.07,
    maxX: -5.5,
    minZ: 8.75,
    maxZ: 13.25,
    y0: 0,
    y1: 1.1,
    axis: 'x',
    fromMin: false
  });

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
      rect(-8.35, -4.5, -0.35, 6.15, 'water'),
      rect(-2.0, 0.35, -0.35, 6.15, 'water'),
      rect(-8.35, -4.75, 6.15, 8.4, 'water'),
      rect(-2.0, 0.35, 6.15, 8.4, 'water'),
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
