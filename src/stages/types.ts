import type { Scene } from '@babylonjs/core';
import type { Character } from '../characters/buildCharacter';
import type { WalkGrid } from '../engine/collision';
import type { DialoguePage } from '../data/content';
import type { PlayerCtl } from '../player/player';
import type { MinimapSchema } from '../ui/minimap';

export type InteractKind = 'talk' | 'investigate' | 'door' | 'ship';

export type Interactable = {
  id: string;
  title: string;
  kind: InteractKind;
  required: boolean;
  radius: number;
  getPosition: () => { x: number; y: number; z: number };
  pages?: DialoguePage[];
  character?: Character;
  talked: boolean;
};

export type StageId = 'kangxi' | 'yongzheng' | 'qianlong';

export type StageContext = {
  scene: Scene;
  grid: WalkGrid;
  player: PlayerCtl;
  interactables: Interactable[];
  requiredIds: string[];
  quizReady: boolean;
  quizDone: boolean;
  passwordDone: boolean;
  update?: (dt: number) => void;
  strengthAt?: (x: number, z: number) => { value: number; kind: 'strong' | 'peak' | 'weak' };
  dispose: () => void;
  minimap?: MinimapSchema;
};

export type StageHandle = StageContext;
