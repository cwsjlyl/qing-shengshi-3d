import {
  AbstractMesh,
  Color3,
  Material,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { PALETTE, stdMat } from '../engine/materials';
import { MODEL, placePack } from '../engine/loadModel';

export type CharacterKind =
  | 'player'
  | 'kangxi'
  | 'yongzheng'
  | 'qianlong'
  | 'manchu'
  | 'han'
  | 'official'
  | 'heshen'
  | 'farmer'
  | 'soldier';

export type CharacterOpts = {
  id: string;
  kind: CharacterKind;
  seated?: boolean;
  variant?: number;
  scale?: number;
};

export type Character = {
  id: string;
  kind: CharacterKind;
  root: TransformNode;
  head: TransformNode;
  height: number;
  setFacing: (radians: number) => void;
  setMove: (speed: number, dt: number) => void;
  markTalked: (done: boolean) => void;
  dispose: () => void;
};

type Colors = {
  robe: string;
  trim: string;
  inner: string;
  hat: string;
  hatJewel: string;
  skin: string;
};

function colorsFor(kind: CharacterKind, variant = 0): Colors {
  switch (kind) {
    case 'kangxi':
      return { robe: PALETTE.kangxiRobe, trim: PALETTE.kangxiTrim, inner: '#7A1020', hat: PALETTE.hatRed, hatJewel: PALETTE.goldBright, skin: PALETTE.skin };
    case 'yongzheng':
      return { robe: PALETTE.yongzhengRobe, trim: PALETTE.yongzhengTrim, inner: '#3A2410', hat: PALETTE.hatBlack, hatJewel: PALETTE.gold, skin: '#E0B898' };
    case 'qianlong':
      return { robe: PALETTE.qianlongRobe, trim: PALETTE.qianlongTrim, inner: '#8B1A1A', hat: PALETTE.hatRed, hatJewel: '#F6E27A', skin: PALETTE.skin };
    case 'manchu':
      return { robe: PALETTE.manchuRobe, trim: PALETTE.manchuTrim, inner: '#C9A227', hat: PALETTE.hatBlack, hatJewel: '#C03030', skin: PALETTE.skin };
    case 'han':
      return { robe: PALETTE.hanRobe, trim: PALETTE.hanTrim, inner: '#E8D8B0', hat: '#2C3A40', hatJewel: '#E8D8B0', skin: PALETTE.skin };
    case 'official':
      return variant === 1
        ? { robe: PALETTE.officialB, trim: '#C4A050', inner: '#3A1818', hat: PALETTE.hatBlack, hatJewel: '#8B1A1A', skin: '#D4A888' }
        : { robe: PALETTE.officialA, trim: '#8A7040', inner: '#3A2A18', hat: PALETTE.hatBlack, hatJewel: '#6A3030', skin: '#C49870' };
    case 'heshen':
      return { robe: PALETTE.heshenRobe, trim: PALETTE.heshenTrim, inner: '#F0D27A', hat: PALETTE.hatRed, hatJewel: PALETTE.goldBright, skin: '#E8C4A0' };
    case 'farmer':
      return { robe: variant === 1 ? '#8A6A42' : PALETTE.farmer, trim: PALETTE.farmerPatch, inner: '#C8B080', hat: PALETTE.straw, hatJewel: '#8A6A30', skin: PALETTE.skinDeep };
    case 'soldier':
      return { robe: PALETTE.soldier, trim: PALETTE.soldierTrim, inner: PALETTE.soldierArmor, hat: '#3A3028', hatJewel: '#8B2E2E', skin: '#D4A07A' };
    case 'player':
    default:
      return { robe: PALETTE.playerRobe, trim: PALETTE.playerTrim, inner: '#F0E4C4', hat: '#1E2A28', hatJewel: '#6E9B8B', skin: PALETTE.skin };
  }
}

function add(
  name: string,
  mesh: Mesh,
  parent: TransformNode,
  mat: StandardMaterial,
  pos: [number, number, number]
): Mesh {
  mesh.name = name;
  mesh.parent = parent;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.material = mat;
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.isPickable = false;
  return mesh;
}

/**
 * Stylised classroom low-poly courtier: arms hang or clasp, readable robe, simple face, distinct hat or bun.
 * Original design — not a copy of any reference character or official portrait.
 */
function buildProceduralCharacter(scene: Scene, opts: CharacterOpts): Character {
  const kind = opts.kind;
  const col = colorsFor(kind, opts.variant);
  const seated = !!opts.seated;
  const chubby = kind === 'heshen' || (kind === 'official' && opts.variant === 1);
  const young = kind === 'player';
  const hunched = kind === 'farmer';
  const scale = opts.scale ?? (young ? 0.96 : kind === 'farmer' ? 0.96 : 1);
  const clasp = kind === 'kangxi' || kind === 'yongzheng' || kind === 'qianlong' || kind === 'heshen' || kind === 'official' || kind === 'han';

  const root = new TransformNode(`char:${opts.id}`, scene);
  root.scaling.setAll(scale);

  const robeM = stdMat(scene, col.robe, { specular: 0.22 });
  const trimM = stdMat(scene, col.trim, { specular: 0.28 });
  const innerM = stdMat(scene, col.inner, { specular: 0.16 });
  const skinM = stdMat(scene, col.skin, { specular: 0.2, emissive: 0.06 });
  const hairM = stdMat(scene, PALETTE.hair, { specular: 0.08 });
  const hatM = stdMat(scene, col.hat, { specular: kind === 'farmer' ? 0.08 : 0.18 });
  const jewelM = stdMat(scene, col.hatJewel, { specular: 0.55, emissive: kind === 'farmer' ? 0 : 0.08 });
  const shoeM = stdMat(scene, PALETTE.shoe, { specular: 0.1 });
  const goldM = stdMat(scene, PALETTE.gold, { specular: 0.5, emissive: 0.06 });
  const eyeWM = stdMat(scene, PALETTE.eyeWhite, { specular: 0.35 });
  const irisM = stdMat(scene, PALETTE.irisDark, { specular: 0.15 });
  const woodM = stdMat(scene, PALETTE.wood, { specular: 0.12 });

  const body = new TransformNode('body', scene);
  body.parent = root;
  if (hunched) body.rotation.x = 0.12;

  const blob = MeshBuilder.CreateDisc('shadow', { radius: chubby ? 0.4 : 0.3, tessellation: 10 }, scene);
  add('shadow', blob, root, stdMat(scene, '#000000', { alpha: 0.28, specular: 0 }), [0, 0.02, 0]);
  blob.rotation.x = Math.PI / 2;

  // Flared skirt / robe hem — the main silhouette.
  const hemH = seated ? 0.62 : 0.86;
  const hem = MeshBuilder.CreateCylinder(
    'hem',
    {
      height: hemH,
      diameterTop: chubby ? 0.48 : 0.4,
      diameterBottom: chubby ? 0.92 : 0.72,
      tessellation: 10
    },
    scene
  );
  add('hem', hem, body, robeM, [0, seated ? 0.4 : 0.5, hunched ? 0.04 : 0]);

  // Chest / torso, slightly flattened so it reads as a robe, not a tube.
  const chest = MeshBuilder.CreateCylinder(
    'chest',
    { height: 0.52, diameterTop: chubby ? 0.42 : 0.34, diameterBottom: chubby ? 0.5 : 0.42, tessellation: 10 },
    scene
  );
  add('chest', chest, body, robeM, [0, seated ? 0.86 : 1.1, 0]);
  chest.scaling.set(1, 1, 0.86);

  // Waist belt
  const belt = MeshBuilder.CreateTorus('belt', { diameter: chubby ? 0.5 : 0.42, thickness: 0.045, tessellation: 10 }, scene);
  add('belt', belt, body, trimM, [0, seated ? 0.64 : 0.86, 0]);
  belt.rotation.x = Math.PI / 2;
  belt.scaling.y = 0.45;

  // Front panel / 補子
  const panel = MeshBuilder.CreateBox('panel', { width: chubby ? 0.2 : 0.16, height: 0.22, depth: 0.04 }, scene);
  add('panel', panel, body, trimM, [0, seated ? 0.9 : 1.14, chubby ? 0.2 : 0.17]);

  // Collar
  const collar = MeshBuilder.CreateTorus('collar', { diameter: chubby ? 0.36 : 0.3, thickness: 0.055, tessellation: 10 }, scene);
  add('collar', collar, body, innerM, [0, seated ? 1.1 : 1.34, 0]);
  collar.rotation.x = Math.PI / 2;
  collar.scaling.y = 0.45;

  // Shoulders
  const shoulderY = seated ? 1.12 : 1.34;
  const shL = MeshBuilder.CreateSphere('shL', { diameter: chubby ? 0.2 : 0.16, segments: 6 }, scene);
  add('shL', shL, body, robeM, [seated ? -0.2 : -0.2, shoulderY, 0]);
  const shR = shL.clone('shR')!;
  shR.parent = body;
  shR.position.x = seated ? 0.2 : 0.2;

  // Arms: hanging down (or brought forward in a clasp). Never a T-pose.
  const armL = new TransformNode('armL', scene);
  armL.parent = body;
  armL.position.set(-0.2, shoulderY, 0);
  const armR = new TransformNode('armR', scene);
  armR.parent = body;
  armR.position.set(0.2, shoulderY, 0);
  if (seated) {
    armL.rotation.set(0.95, 0.15, 0.35);
    armR.rotation.set(0.95, -0.15, -0.35);
  } else if (clasp) {
    armL.rotation.set(0.55, 0.45, 0.45);
    armR.rotation.set(0.55, -0.45, -0.45);
  } else {
    // Arms hang beside the robe, slightly forward.
    armL.rotation.set(0.12, 0.05, 0.16);
    armR.rotation.set(0.12, -0.05, -0.16);
  }

  const sleeveLen = seated ? 0.52 : 0.7;
  const sleeveL = MeshBuilder.CreateCylinder(
    'sleeveL',
    { height: sleeveLen, diameterTop: 0.14, diameterBottom: 0.22, tessellation: 8 },
    scene
  );
  add('sleeveL', sleeveL, armL, robeM, [0, -sleeveLen * 0.5, 0]);
  const cuffL = MeshBuilder.CreateTorus('cuffL', { diameter: 0.2, thickness: 0.035, tessellation: 8 }, scene);
  add('cuffL', cuffL, armL, innerM, [0, -sleeveLen + 0.04, 0]);
  cuffL.scaling.y = 0.4;
  const handL = MeshBuilder.CreateSphere('handL', { diameter: 0.09, segments: 6 }, scene);
  add('handL', handL, armL, skinM, [0, -sleeveLen - 0.02, 0.02]);

  const sleeveR = sleeveL.clone('sleeveR')!;
  sleeveR.parent = armR;
  sleeveR.position.set(0, -sleeveLen * 0.5, 0);
  const cuffR = cuffL.clone('cuffR')!;
  cuffR.parent = armR;
  cuffR.position.set(0, -sleeveLen + 0.04, 0);
  const handR = handL.clone('handR')!;
  handR.parent = armR;
  handR.position.set(0, -sleeveLen - 0.02, 0.02);

  if (!seated) {
    const legL = MeshBuilder.CreateCylinder('legL', { height: 0.36, diameter: 0.12, tessellation: 6 }, scene);
    add('legL', legL, body, robeM, [-0.11, 0.22, 0]);
    const legR = legL.clone('legR')!;
    legR.parent = body;
    legR.position.set(0.11, 0.22, 0);
    const shoeL = MeshBuilder.CreateBox('shoeL', { width: 0.11, height: 0.07, depth: 0.2 }, scene);
    add('shoeL', shoeL, body, shoeM, [-0.11, 0.045, 0.03]);
    const shoeR = shoeL.clone('shoeR')!;
    shoeR.parent = body;
    shoeR.position.set(0.11, 0.045, 0.03);
  }

  const headRoot = new TransformNode('headRoot', scene);
  headRoot.parent = body;
  headRoot.position.set(0, seated ? 1.22 : 1.48, 0);

  const neck = MeshBuilder.CreateCylinder('neck', { height: 0.1, diameter: 0.11, tessellation: 6 }, scene);
  add('neck', neck, headRoot, skinM, [0, 0.02, 0]);

  const head = MeshBuilder.CreateSphere('head', { diameter: young ? 0.3 : 0.32, segments: 10 }, scene);
  add('head', head, headRoot, skinM, [0, 0.2, 0]);
  head.scaling.set(0.95, 1.06, 0.92);

  const earL = MeshBuilder.CreateSphere('earL', { diameter: 0.075, segments: 5 }, scene);
  add('earL', earL, headRoot, skinM, [-0.145, 0.2, 0]);
  earL.scaling.set(0.5, 1, 0.75);
  const earR = earL.clone('earR')!;
  earR.parent = headRoot;
  earR.position.x = 0.145;

  // Calm stylised face: small almond eyes, modest iris, soft lid and brow, a slight nose shadow.
  const irisWarm = stdMat(scene, PALETTE.irisBrown, { specular: 0.18, emissive: 0.04 });
  const noseShade = stdMat(scene, col.skin, { specular: 0.14, emissive: 0.03 });
  // Darken the nose material a little without affecting the shared skin cache.
  try {
    noseShade.unfreeze();
  } catch {
    /* ok */
  }
  noseShade.diffuseColor = noseShade.diffuseColor.scale(0.86);

  const eyeL = MeshBuilder.CreateSphere('eyeL', { diameter: 0.058, segments: 6 }, scene);
  add('eyeL', eyeL, headRoot, eyeWM, [-0.05, 0.224, 0.128]);
  eyeL.scaling.set(1.22, 0.46, 0.4);
  const eyeR = eyeL.clone('eyeR')!;
  eyeR.parent = headRoot;
  eyeR.position.x = 0.05;

  const irisL = MeshBuilder.CreateSphere('irisL', { diameter: 0.04, segments: 5 }, scene);
  add('irisL', irisL, headRoot, irisWarm, [-0.05, 0.223, 0.14]);
  irisL.scaling.set(1.05, 0.82, 0.65);
  const irisR = irisL.clone('irisR')!;
  irisR.parent = headRoot;
  irisR.position.x = 0.05;

  const lidL = MeshBuilder.CreateBox('lidL', { width: 0.074, height: 0.014, depth: 0.026 }, scene);
  add('lidL', lidL, headRoot, skinM, [-0.05, 0.24, 0.136]);
  lidL.rotation.x = -0.2;
  const lidR = lidL.clone('lidR')!;
  lidR.parent = headRoot;
  lidR.position.x = 0.05;

  const browL = MeshBuilder.CreateBox('browL', { width: 0.07, height: 0.01, depth: 0.014 }, scene);
  add('browL', browL, headRoot, hairM, [-0.05, 0.262, 0.136]);
  browL.rotation.z = kind === 'yongzheng' ? 0.16 : kind === 'heshen' ? -0.12 : 0.05;
  const browR = browL.clone('browR')!;
  browR.parent = headRoot;
  browR.position.x = 0.05;
  browR.rotation.z = -browL.rotation.z;

  const nose = MeshBuilder.CreateBox('nose', { width: 0.026, height: 0.038, depth: 0.036 }, scene);
  add('nose', nose, headRoot, noseShade, [0, 0.2, 0.148]);

  const mouth = MeshBuilder.CreateBox('mouth', { width: 0.06, height: 0.01, depth: 0.012 }, scene);
  const mouthColor = kind === 'heshen' || kind === 'qianlong' ? stdMat(scene, '#A04848', { specular: 0.1 }) : hairM;
  add('mouth', mouth, headRoot, mouthColor, [0, 0.145, 0.145]);

  if (kind === 'kangxi' || kind === 'yongzheng' || kind === 'qianlong' || kind === 'han') {
    const stache = MeshBuilder.CreateBox('stache', { width: 0.12, height: 0.016, depth: 0.02 }, scene);
    add('stache', stache, headRoot, hairM, [0, 0.16, 0.15]);
  }
  if (kind === 'kangxi' || kind === 'han' || kind === 'yongzheng') {
    const beard = MeshBuilder.CreateBox('beard', { width: 0.05, height: 0.11, depth: 0.03 }, scene);
    add('beard', beard, headRoot, hairM, [0, 0.1, 0.125]);
  }

  buildHairAndHat(scene, kind, headRoot, hatM, jewelM, hairM, goldM);

  if (kind === 'kangxi' || kind === 'yongzheng' || kind === 'qianlong' || kind === 'heshen') {
    const beads = MeshBuilder.CreateTorus('beads', { diameter: 0.28, thickness: 0.032, tessellation: 10 }, scene);
    add('beads', beads, body, kind === 'heshen' ? goldM : jewelM, [0, seated ? 1.0 : 1.26, 0.05]);
    beads.rotation.x = 0.55;
  }

  if (kind === 'farmer') {
    const patch = MeshBuilder.CreateBox('patch', { width: 0.14, height: 0.12, depth: 0.04 }, scene);
    add('patch', patch, body, trimM, [0.14, 1.0, 0.18]);
    const hoe = new TransformNode('hoe', scene);
    hoe.parent = armR;
    hoe.position.set(0.02, -sleeveLen - 0.02, 0.04);
    hoe.rotation.set(-0.15, 0, -0.1);
    const shaft = MeshBuilder.CreateCylinder('shaft', { height: 1.15, diameter: 0.035, tessellation: 5 }, scene);
    add('shaft', shaft, hoe, woodM, [0, 0.45, 0]);
    const blade = MeshBuilder.CreateBox('blade', { width: 0.18, height: 0.04, depth: 0.12 }, scene);
    add('blade', blade, hoe, stdMat(scene, '#6A6A70', { specular: 0.4 }), [0, 1.02, 0.04]);
  }

  if (kind === 'soldier') {
    const armor = MeshBuilder.CreateBox('armor', { width: 0.34, height: 0.26, depth: 0.18 }, scene);
    add('armor', armor, body, innerM, [0, 1.16, 0.02]);
    const spear = new TransformNode('spear', scene);
    spear.parent = body;
    spear.position.set(0.28, 0.15, 0.06);
    const pole = MeshBuilder.CreateCylinder('pole', { height: 2.15, diameter: 0.04, tessellation: 5 }, scene);
    add('pole', pole, spear, woodM, [0, 1.05, 0]);
    const tip = MeshBuilder.CreateCylinder('tip', { height: 0.22, diameterTop: 0.01, diameterBottom: 0.07, tessellation: 6 }, scene);
    add('tip', tip, spear, stdMat(scene, '#C0C4C8', { specular: 0.6 }), [0, 2.2, 0]);
    const tassel = MeshBuilder.CreateBox('tassel', { width: 0.04, height: 0.1, depth: 0.04 }, scene);
    add('tassel', tassel, spear, stdMat(scene, PALETTE.soldierTrim, { specular: 0.1 }), [0, 2.04, 0.04]);
  }

  const bang = MeshBuilder.CreateBox('bang', { width: 0.08, height: 0.22, depth: 0.08 }, scene);
  const bangM = stdMat(scene, '#E6C35C', { emissive: 0.35, specular: 0.2 });
  add('bang', bang, root, bangM, [0, seated ? 2.15 : 2.2, 0]);
  const bangDot = MeshBuilder.CreateBox('bangDot', { width: 0.08, height: 0.08, depth: 0.08 }, scene);
  add('bangDot', bangDot, root, bangM, [0, seated ? 1.92 : 1.97, 0]);
  bang.isVisible = kind !== 'player';
  bangDot.isVisible = kind !== 'player';

  let walkPhase = 0;
  const limbL = body.getChildren().find((n) => n.name === 'legL') as Mesh | undefined;
  const limbR = body.getChildren().find((n) => n.name === 'legR') as Mesh | undefined;
  const restL = armL.rotation.clone();
  const restR = armR.rotation.clone();

  const setFacing = (radians: number) => {
    root.rotation.y = radians;
  };

  const setMove = (speed: number, dt: number) => {
    const t = performance.now() * 0.001;
    headRoot.position.y = (seated ? 1.22 : 1.48) + Math.sin(t * 1.6) * 0.008;
    if (speed > 0.08 && !seated) {
      walkPhase += dt * speed * 8;
      const s = Math.sin(walkPhase);
      if (limbL) limbL.rotation.x = s * 0.5;
      if (limbR) limbR.rotation.x = -s * 0.5;
      armL.rotation.x = restL.x - s * 0.28;
      armR.rotation.x = restR.x + s * 0.28;
      body.position.y = Math.abs(s) * 0.03;
    } else {
      if (limbL) limbL.rotation.x *= 0.8;
      if (limbR) limbR.rotation.x *= 0.8;
      armL.rotation.x += (restL.x - armL.rotation.x) * 0.2;
      armR.rotation.x += (restR.x - armR.rotation.x) * 0.2;
      body.position.y *= 0.8;
    }
  };

  const markTalked = (done: boolean) => {
    bang.isVisible = !done && kind !== 'player';
    bangDot.isVisible = !done && kind !== 'player';
  };

  return {
    id: opts.id,
    kind,
    root,
    head: headRoot,
    height: (seated ? 1.7 : 1.74) * scale,
    setFacing,
    setMove,
    markTalked,
    dispose: () => root.dispose()
  };
}

function buildHairAndHat(
  scene: Scene,
  kind: CharacterKind,
  headRoot: TransformNode,
  hatM: StandardMaterial,
  jewelM: StandardMaterial,
  hairM: StandardMaterial,
  goldM: StandardMaterial
): void {
  // Hair cap under every hat, so the silhouette is never a bald sphere.
  const cap = MeshBuilder.CreateSphere('hairCap', { diameter: 0.3, segments: 8 }, scene);
  add('hairCap', cap, headRoot, hairM, [0, 0.28, -0.01]);
  cap.scaling.set(1.02, 0.55, 1.0);

  if (kind === 'player') {
    // Young attendant: bun, not an official hat.
    const bun = MeshBuilder.CreateSphere('bun', { diameter: 0.14, segments: 7 }, scene);
    add('bun', bun, headRoot, hairM, [0, 0.38, -0.08]);
    const knot = MeshBuilder.CreateSphere('knot', { diameter: 0.08, segments: 6 }, scene);
    add('knot', knot, headRoot, hairM, [0, 0.46, -0.04]);
    const pin = MeshBuilder.CreateCylinder('pin', { height: 0.12, diameter: 0.018, tessellation: 5 }, scene);
    add('pin', pin, headRoot, jewelM, [0.05, 0.4, -0.08]);
    pin.rotation.z = 1.15;
    return;
  }

  if (kind === 'farmer') {
    const bun = MeshBuilder.CreateSphere('bun', { diameter: 0.11, segments: 6 }, scene);
    add('bun', bun, headRoot, hairM, [0, 0.36, -0.06]);
    const cone = MeshBuilder.CreateCylinder('straw', { height: 0.12, diameterTop: 0.08, diameterBottom: 0.64, tessellation: 8 }, scene);
    add('straw', cone, headRoot, hatM, [0, 0.42, -0.04]);
    cone.rotation.x = -0.12;
    const crown = MeshBuilder.CreateCylinder('crown', { height: 0.1, diameter: 0.16, tessellation: 8 }, scene);
    add('crown', crown, headRoot, hatM, [0, 0.48, 0]);
    return;
  }

  if (kind === 'han') {
    const bun = MeshBuilder.CreateSphere('bun', { diameter: 0.12, segments: 6 }, scene);
    add('bun', bun, headRoot, hairM, [0, 0.4, -0.04]);
    const soft = MeshBuilder.CreateCylinder('cap', { height: 0.1, diameter: 0.28, tessellation: 8 }, scene);
    add('cap', soft, headRoot, hatM, [0, 0.36, 0.02]);
    const flap = MeshBuilder.CreateBox('flap', { width: 0.2, height: 0.02, depth: 0.08 }, scene);
    add('flap', flap, headRoot, hatM, [0, 0.32, -0.14]);
    return;
  }

  if (kind === 'soldier') {
    const helm = MeshBuilder.CreateSphere('helm', { diameter: 0.34, segments: 8 }, scene);
    add('helm', helm, headRoot, hatM, [0, 0.3, 0]);
    helm.scaling.set(1, 0.72, 1);
    const brim = MeshBuilder.CreateCylinder('hbrim', { height: 0.04, diameter: 0.38, tessellation: 8 }, scene);
    add('hbrim', brim, headRoot, hatM, [0, 0.26, 0]);
    const spike = MeshBuilder.CreateCylinder('spike', { height: 0.16, diameterTop: 0.02, diameterBottom: 0.08, tessellation: 6 }, scene);
    add('spike', spike, headRoot, jewelM, [0, 0.5, 0]);
    return;
  }

  // Official / imperial Qing hat: upturned brim, crown, jewel finial.
  const brim = MeshBuilder.CreateCylinder('brim', { height: 0.045, diameter: 0.42, tessellation: 10 }, scene);
  add('brim', brim, headRoot, hatM, [0, 0.32, 0]);
  const crown = MeshBuilder.CreateCylinder('crown', { height: 0.18, diameterTop: 0.15, diameterBottom: 0.27, tessellation: 8 }, scene);
  add('crown', crown, headRoot, hatM, [0, 0.43, 0]);
  const finial = MeshBuilder.CreateCylinder('finial', { height: 0.1, diameter: 0.045, tessellation: 6 }, scene);
  add('finial', finial, headRoot, goldM, [0, 0.56, 0]);
  const bead = MeshBuilder.CreateSphere('bead', { diameter: 0.07, segments: 6 }, scene);
  add('bead', bead, headRoot, jewelM, [0, 0.63, 0]);

  const queue = MeshBuilder.CreateCylinder('queue', { height: 0.5, diameter: 0.048, tessellation: 5 }, scene);
  add('queue', queue, headRoot, hairM, [0, 0.02, -0.16]);
  queue.rotation.x = 0.5;

  if (kind === 'kangxi' || kind === 'qianlong' || kind === 'heshen') {
    const pearl = MeshBuilder.CreateSphere('pearl', { diameter: 0.045, segments: 5 }, scene);
    add('pearl', pearl, headRoot, stdMat(scene, '#F4F0E8', { specular: 0.7, emissive: 0.1 }), [0, 0.7, 0]);
  }
}


const TRIPO_KINDS: CharacterKind[] = ['player', 'kangxi', 'yongzheng', 'qianlong', 'official', 'heshen', 'manchu'];
const MODEL_HEIGHT = 1.74;
const HEAD_Y = 1.48;

function tintHex(mat: Material, hex: string): void {
  const c = Color3.FromHexString(hex);
  if (mat instanceof PBRMaterial) {
    mat.albedoColor = c;
  } else if (mat instanceof StandardMaterial) {
    mat.diffuseColor = c;
  }
}

function applyTripoColors(meshes: AbstractMesh[], id: string, col: Colors): void {
  const clones = new Map<string, Material>();
  for (const mesh of meshes) {
    const mat = mesh.material;
    if (!mat) continue;
    const raw = mat.name;
    const kind = raw.replace(/^.*tripo-/, '').split(/[:\s]/)[0];
    const hex =
      kind === 'robe' ? col.robe
      : kind === 'trim' ? col.trim
      : kind === 'hatBrim' ? col.hat
      : kind === 'skin' ? col.skin
      : kind === 'gold' ? col.hatJewel
      : null;
    if (!hex) continue;
    let clone = clones.get(kind);
    if (!clone) {
      clone = mat.clone(`tripo-${kind}:${id}`) ?? mat;
      tintHex(clone, hex);
      clones.set(kind, clone);
    }
    mesh.material = clone;
  }
}


/** Stylised classroom eyes and brows on the unit-height Tripo mesh (scaled 1.74 with the model). */
function addTripoFace(scene: Scene, parent: TransformNode, kind: CharacterKind): void {
  const player = kind === 'player';
  // Local unit-mesh coordinates. Emperor face only reaches z≈0.04; hands sit near z=0.14.
  // Attendant eyes sit beside the upper nose (tip ≈ y 0.87, hairline ≈ 0.91), flush to the skin
  // so a downward talk camera does not read them as a moustache on the cheeks.
  const eyeLPos: [number, number, number] = player ? [-0.022, 0.878, 0.055] : [-0.024, 0.816, 0.037];
  const eyeRPos: [number, number, number] = player ? [0.02, 0.876, 0.051] : [0.024, 0.812, 0.037];
  const irisPush = player ? 0.003 : 0.004;
  const browLift = player ? 0.015 : 0.016;
  const eyeWM = stdMat(scene, PALETTE.eyeWhite, { specular: 0.35 });
  const irisM = stdMat(scene, PALETTE.irisDark, { specular: 0.15 });
  const browM = stdMat(scene, PALETTE.hair, { specular: 0.08 });

  const eyeL = MeshBuilder.CreateSphere('tripo-eyeL', { diameter: player ? 0.03 : 0.032, segments: 6 }, scene);
  add('tripo-eyeL', eyeL, parent, eyeWM, eyeLPos);
  eyeL.scaling.set(1.2, 0.48, 0.36);
  const eyeR = eyeL.clone('tripo-eyeR')!;
  eyeR.parent = parent;
  eyeR.position.set(eyeRPos[0], eyeRPos[1], eyeRPos[2]);

  const irisL = MeshBuilder.CreateSphere('tripo-irisL', { diameter: player ? 0.015 : 0.016, segments: 5 }, scene);
  add('tripo-irisL', irisL, parent, irisM, [eyeLPos[0], eyeLPos[1] - 0.001, eyeLPos[2] + irisPush]);
  irisL.scaling.set(1.05, 0.78, 0.55);
  const irisR = irisL.clone('tripo-irisR')!;
  irisR.parent = parent;
  irisR.position.set(eyeRPos[0], eyeRPos[1] - 0.001, eyeRPos[2] + irisPush);

  const browL = MeshBuilder.CreateBox('tripo-browL', { width: 0.038, height: 0.006, depth: 0.008 }, scene);
  add('tripo-browL', browL, parent, browM, [eyeLPos[0], eyeLPos[1] + browLift, eyeLPos[2] + 0.001]);
  browL.rotation.z = kind === 'yongzheng' ? 0.16 : kind === 'heshen' ? -0.12 : 0.06;
  const browR = browL.clone('tripo-browR')!;
  browR.parent = parent;
  browR.position.set(eyeRPos[0], eyeRPos[1] + browLift, eyeRPos[2] + 0.001);
  browR.rotation.z = -browL.rotation.z;
}

async function buildTripoCharacter(scene: Scene, opts: CharacterOpts): Promise<Character> {
  const kind = opts.kind;
  const col = colorsFor(kind, opts.variant);
  const scale = opts.scale ?? (kind === 'player' ? 0.96 : 1);
  const url = kind === 'player' ? MODEL.tripoAttendant : MODEL.tripoEmperor;

  const root = new TransformNode(`char:${opts.id}`, scene);
  root.scaling.setAll(scale);

  const body = new TransformNode('body', scene);
  body.parent = root;

  const placed = await placePack(scene, url, {
    name: `char:${opts.id}/model`,
    scaling: MODEL_HEIGHT
  });
  placed.root.parent = body;
  placed.root.position.set(0, 0, 0);
  placed.root.rotation.set(0, 0, 0);

  applyTripoColors(placed.meshes, opts.id, col);
  addTripoFace(scene, placed.root, kind);
  for (const mesh of placed.meshes) {
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.receiveShadows = true;
  }

  const blob = MeshBuilder.CreateDisc('shadow', { radius: kind === 'heshen' ? 0.4 : 0.3, tessellation: 10 }, scene);
  add('shadow', blob, root, stdMat(scene, '#000000', { alpha: 0.28, specular: 0 }), [0, 0.02, 0]);
  blob.rotation.x = Math.PI / 2;

  const headRoot = new TransformNode('head', scene);
  headRoot.parent = root;
  headRoot.position.set(0, HEAD_Y, 0);

  const bang = MeshBuilder.CreateBox('bang', { width: 0.08, height: 0.22, depth: 0.08 }, scene);
  const bangM = stdMat(scene, '#E6C35C', { emissive: 0.35, specular: 0.2 });
  add('bang', bang, root, bangM, [0, 2.2, 0]);
  const bangDot = MeshBuilder.CreateBox('bangDot', { width: 0.08, height: 0.08, depth: 0.08 }, scene);
  add('bangDot', bangDot, root, bangM, [0, 1.97, 0]);
  bang.isVisible = kind !== 'player';
  bangDot.isVisible = kind !== 'player';

  let walkPhase = 0;
  const setFacing = (radians: number) => {
    root.rotation.y = radians;
  };
  const setMove = (speed: number, dt: number) => {
    const t = performance.now() * 0.001;
    headRoot.position.y = HEAD_Y + Math.sin(t * 1.6) * 0.008;
    if (speed > 0.08) {
      walkPhase += dt * speed * 8;
      const s = Math.sin(walkPhase);
      body.position.y = Math.abs(s) * 0.03;
      // Whole-body sway only — the free-plan GLBs have no bones, and the
      // emperor's hands are clasped, so we do not swing the arms.
      body.rotation.y = s * 0.045;
      body.rotation.z = s * 0.03;
    } else {
      body.position.y *= 0.8;
      body.rotation.y *= 0.8;
      body.rotation.z *= 0.8;
    }
  };
  const markTalked = (done: boolean) => {
    bang.isVisible = !done && kind !== 'player';
    bangDot.isVisible = !done && kind !== 'player';
  };

  return {
    id: opts.id,
    kind,
    root,
    head: headRoot,
    height: MODEL_HEIGHT * scale,
    setFacing,
    setMove,
    markTalked,
    dispose: () => root.dispose()
  };
}

/** Procedural (han / farmer / soldier) or Tripo base mesh (player and court robes). */
export async function buildCharacter(scene: Scene, opts: CharacterOpts): Promise<Character> {
  if (TRIPO_KINDS.includes(opts.kind)) return buildTripoCharacter(scene, opts);
  return buildProceduralCharacter(scene, opts);
}

export function attachToWorld(c: Character, x: number, y: number, z: number, facing = 0): Character {
  c.root.position.set(x, y, z);
  c.setFacing(facing);
  c.root.computeWorldMatrix(true);
  for (const mesh of c.root.getChildMeshes(false)) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(false, false);
    mesh.alwaysSelectAsActiveMesh = true;
  }
  return c;
}
