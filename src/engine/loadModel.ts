import {
  AbstractMesh,
  AssetContainer,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export type PlacedModel = {
  root: TransformNode;
  container: AssetContainer;
  meshes: AbstractMesh[];
  shared?: boolean;
};

const containerCache = new Map<string, AssetContainer>();

export async function loadContainer(scene: Scene, url: string): Promise<AssetContainer> {
  const lastSlash = url.lastIndexOf('/');
  const root = lastSlash >= 0 ? url.slice(0, lastSlash + 1) : './';
  const file = lastSlash >= 0 ? url.slice(lastSlash + 1) : url;
  return SceneLoader.LoadAssetContainerAsync(root, file, scene);
}

export async function placeModel(
  scene: Scene,
  url: string,
  opts: {
    name: string;
    position?: Vector3;
    rotationY?: number;
    scaling?: number | Vector3;
  }
): Promise<PlacedModel> {
  const container = await loadContainer(scene, url);
  container.addAllToScene();
  const root = new TransformNode(opts.name, scene);
  for (const node of container.getNodes()) {
    if (!node.parent) node.parent = root;
  }
  if (opts.position) root.position.copyFrom(opts.position);
  if (opts.rotationY) root.rotation.y = opts.rotationY;
  if (opts.scaling != null) {
    if (typeof opts.scaling === 'number') root.scaling.setAll(opts.scaling);
    else root.scaling.copyFrom(opts.scaling);
  }
  for (const mesh of container.meshes) {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = false;
  }
  return { root, container, meshes: container.meshes };
}

export async function placePack(
  scene: Scene,
  url: string,
  opts: {
    name: string;
    position?: Vector3;
    rotationY?: number;
    scaling?: number | Vector3;
  }
): Promise<PlacedModel> {
  let template = containerCache.get(url);
  if (!template) {
    template = await loadContainer(scene, url);
    containerCache.set(url, template);
  }
  const inst = template.instantiateModelsToScene((n) => `${opts.name}/${n}`, false);
  const root = new TransformNode(opts.name, scene);
  for (const node of inst.rootNodes) {
    node.parent = root;
  }
  if (opts.position) root.position.copyFrom(opts.position);
  if (opts.rotationY) root.rotation.y = opts.rotationY;
  if (opts.scaling != null) {
    if (typeof opts.scaling === 'number') root.scaling.setAll(opts.scaling);
    else root.scaling.copyFrom(opts.scaling);
  }
  const meshes: AbstractMesh[] = [];
  for (const node of inst.rootNodes) {
    if (node instanceof AbstractMesh) meshes.push(node);
    for (const child of (node as TransformNode).getChildMeshes?.(false) ?? []) {
      meshes.push(child);
    }
  }
  for (const mesh of meshes) {
    mesh.isPickable = false;
  }
  return { root, container: template, meshes, shared: true };
}

export function disposePlaced(models: PlacedModel[]): void {
  for (const m of models) {
    if (!m.shared) {
      try {
        m.container.dispose();
      } catch {
        /* already disposed with the scene */
      }
    }
    m.root.dispose();
  }
  models.length = 0;
}

export function freezeStatic(root: TransformNode): void {
  for (const mesh of root.getChildMeshes(false)) {
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    mesh.isPickable = false;
  }
}

export function clearModelCache(): void {
  containerCache.clear();
}

export const MODEL = {
  courtyard: './assets/models/courtyard.glb',
  hall: './assets/models/ceremonial-hall.glb',
  gate: './assets/models/gate-tower.glb',
  wallStraight: './assets/models/wall-straight.glb',
  wallCorner: './assets/models/wall-corner.glb',
  moonGate: './assets/models/wall-moon-gate.glb',
  wallEnd: './assets/models/wall-end-pier.glb',
  throne: './assets/models/throne.glb',
  footstool: './assets/models/footstool.glb',
  lions: './assets/models/guardian-lions.glb',
  screen: './assets/models/folding-screen.glb',
  lanternStanding: './assets/models/lantern-standing.glb',
  lanternHanging: './assets/models/lantern-hanging.glb',
  cauldron: './assets/models/cauldron.glb',
  banner: './assets/models/banner-pole.glb',
  pennant: './assets/models/pennant-pair.glb',
  chest: './assets/models/chest.glb',
  desk: './assets/models/writing-desk.glb',
  cushion: './assets/models/floor-cushion.glb',
  parasol: './assets/models/parasol.glb',
  column: './assets/models/column.glb',
  terrace: './assets/models/terrace-platform.glb',
  steps: './assets/models/terrace-steps.glb',
  paving: './assets/models/paving.glb',
  waterPavilion: './assets/models/water-pavilion.glb',
  lotusPavilion: './assets/models/lotus-pavilion.glb',
  rockery: './assets/models/rockery.glb',
  bamboo: './assets/models/bamboo.glb',
  plum: './assets/models/plum-tree.glb',
  stone: './assets/models/scholars-stone.glb',
  rack: './assets/models/weapon-rack.glb',
  bridge: './assets/models/stone-bridge.glb',
  incense: './assets/models/incense-burner.glb',
  altar: './assets/models/altar-table.glb',
  drum: './assets/models/ceremonial-drum.glb',
  brazier: './assets/models/brazier.glb',
  bonsai: './assets/models/bonsai.glb',
  bench: './assets/models/stone-bench.glb',
  well: './assets/models/courtyard-well.glb',
  brush: './assets/models/brush-stand.glb',
  scrolls: './assets/models/scroll-rack.glb',
  lotus: './assets/models/lotus-cluster.glb',
  balustrade: './assets/models/stone-balustrade.glb',
  pondEdge: './assets/models/lotus-pond-edge.glb',
  pondEdgeCorner: './assets/models/lotus-pond-edge-corner.glb',
  waterLantern: './assets/models/floating-water-lantern.glb',
  peony: './assets/models/peony-planter.glb',
  stepping: './assets/models/stepping-stone-path.glb',
  walkwayBay: './assets/models/covered-walkway-bay.glb',
  walkwayCorner: './assets/models/covered-walkway-corner.glb',
  latticeDoor: './assets/models/latticed-screen-door.glb',
  roofFinial: './assets/models/dragon-roof-finial.glb',
  teaTable: './assets/models/low-tea-table.glb',
  teaSet: './assets/models/tea-set.glb',
  guqin: './assets/models/guqin.glb',
  inkstone: './assets/models/inkstone.glb',
  hangingScrolls: './assets/models/hanging-scroll-pair.glb',
  bell: './assets/models/bronze-bell.glb',
  meshyLantern: './assets/models/meshy-lantern.glb',
  meshyBoat: './assets/models/meshy-imperial-boat.glb',
  meshyPavilion: './assets/models/meshy-pavilion.glb',
  meshyMoonGate: './assets/models/meshy-moon-gate.glb',
  meshyPeony: './assets/models/meshy-garden-peony.glb',
  meshyStool: './assets/models/meshy-stone-drum-stool.glb',
  meshyFlagstones: './assets/models/meshy-court-flagstones.glb',
  tripoAttendant: './assets/models/tripo-young-attendant.glb',
  tripoEmperor: './assets/models/tripo-court-emperor.glb'
} as const;
