import type { Scene } from '@babylonjs/core';
import { MODEL, placePack, type PlacedModel } from '../engine/loadModel';
import type { Barge } from './imperialBarge';

/** Source mesh length along X after origin rebase. */
const MESHY_BOAT_MESH_LEN = 1.8966026306152344;
/** Visual length of the 南巡 flagship, close to the procedural hull (28). */
export const MESHY_BOAT_SCALE = 26 / MESHY_BOAT_MESH_LEN;
/** Approximate deck height in flagship-local space (hull top after scale). */
export const MESHY_BOAT_DECK_Y = 0.42 * MESHY_BOAT_SCALE;

/**
 * Replace the visible procedural flagship with the Meshy imperial boat.
 * Gameplay (root name, length, width, boardPoint, departure parent) is unchanged.
 * Escorts should not call this. Kept out of imperialBarge.ts so the title
 * beauty shot does not pull the glTF loader into the first barge chunk.
 */
export async function attachMeshyFlagshipVisual(scene: Scene, barge: Barge): Promise<PlacedModel | null> {
  try {
    const placed = await placePack(scene, MODEL.meshyBoat, {
      name: 'meshy-flagship',
      scaling: MESHY_BOAT_SCALE
    });
    for (const mesh of barge.root.getChildMeshes(false)) {
      mesh.isVisible = false;
    }
    placed.root.parent = barge.root;
    placed.root.position.set(0, 0, 0);
    // Mesh length is along X, bow at +X; flagship length is along local +Z.
    placed.root.rotation.y = Math.PI / 2;
    for (const mesh of placed.meshes) {
      mesh.isPickable = false;
      mesh.isVisible = true;
    }
    barge.root.metadata = {
      ...(typeof barge.root.metadata === 'object' && barge.root.metadata ? barge.root.metadata : {}),
      meshyDeckY: MESHY_BOAT_DECK_Y + 0.15,
      meshyCamY: MESHY_BOAT_DECK_Y + 1.4,
      meshyCamR: 32
    };
    return placed;
  } catch (err) {
    console.warn('Meshy flagship visual failed; keeping the procedural barge.', err);
    return null;
  }
}
