import { Vector3 } from '@babylonjs/core';
import type { Character } from '../characters/buildCharacter';
import type { DialoguePage } from '../data/content';
import type { Interactable, InteractKind } from './types';

export function npcInteractable(
  id: string,
  title: string,
  character: Character,
  pages: DialoguePage[],
  opts: { required?: boolean; radius?: number; kind?: InteractKind } = {}
): Interactable {
  return {
    id,
    title,
    kind: opts.kind ?? 'talk',
    required: opts.required !== false,
    radius: opts.radius ?? 2.3,
    getPosition: () => {
      const p = character.root.getAbsolutePosition();
      return { x: p.x, y: p.y, z: p.z };
    },
    pages,
    character,
    talked: false
  };
}

export function pointInteractable(
  id: string,
  title: string,
  position: Vector3,
  pages: DialoguePage[],
  opts: { required?: boolean; radius?: number; kind?: InteractKind } = {}
): Interactable {
  return {
    id,
    title,
    kind: opts.kind ?? 'investigate',
    required: opts.required !== false,
    radius: opts.radius ?? 2.6,
    getPosition: () => ({ x: position.x, y: position.y, z: position.z }),
    pages,
    talked: false
  };
}

export async function mapSettle<T>(
  items: T[],
  fn: (item: T, i: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const total = items.length;
  let done = 0;
  for (let i = 0; i < items.length; i++) {
    await fn(items[i], i);
    done += 1;
    onProgress?.(done, total);
  }
}
