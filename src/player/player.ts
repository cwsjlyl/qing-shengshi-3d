import { AbstractMesh, ArcRotateCamera, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { buildCharacter, type Character } from '../characters/buildCharacter';
import type { WalkGrid } from '../engine/collision';
import type { Input } from '../engine/input';
import { OcclusionFader } from '../engine/occlusionFade';
import type { Joystick } from '../ui/joystick';
import type { HUD } from '../ui/hud';
import { cameraRelativeMove } from './moveMath';

export type PlayerCtl = {
  character: Character;
  camera: ArcRotateCamera;
  getPosition: () => Vector3;
  setPosition: (x: number, y: number, z: number) => void;
  setView: (alpha: number, beta: number, radius: number) => void;
  beginTalkFrame: (npc: Vector3, facing?: number) => void;
  endTalkFrame: () => void;
  update: (dt: number) => void;
  setLocked: (locked: boolean) => void;
  parentTo: (node: TransformNode | null) => void;
  dispose: () => void;
};

/** Closer, lower third-person: player sits in the lower-middle, architecture ahead. */
const DEFAULT_RADIUS = 6.4;
const DEFAULT_BETA = 1.36;
const TARGET_HEIGHT = 1.12;
const LOOK_AHEAD = 1.7;
const FOOT_R = 0.32;
const TARGET_SMOOTH = 7.5;
const LOOK_YAW_SMOOTH = 5.2;
const RADIUS_IN = 6.5;
const RADIUS_OUT = 3.2;
const BETA_SMOOTH = 6;
const OCC_HOLD = 0.22;
const OCC_MARGIN = 0.4;

function expLerp(cur: number, dest: number, rate: number, dt: number): number {
  return cur + (dest - cur) * (1 - Math.exp(-rate * dt));
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export async function createPlayer(
  scene: Scene,
  canvas: HTMLCanvasElement,
  input: Input,
  joystick: Joystick,
  hud: HUD,
  grid: WalkGrid,
  spawn: { x: number; y?: number; z: number; facing?: number },
  speed = 4.2
): Promise<PlayerCtl> {
  const character = await buildCharacter(scene, { id: 'player', kind: 'player' });
  const y0 = spawn.y ?? grid.heightAt(spawn.x, spawn.z, FOOT_R);
  character.root.position.set(spawn.x, y0, spawn.z);
  character.setFacing(spawn.facing ?? 0);
  character.root.computeWorldMatrix(true);
  for (const mesh of character.root.getChildMeshes(false)) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(false, false);
    mesh.alwaysSelectAsActiveMesh = true;
  }

  const facing0 = spawn.facing ?? 0;
  const camera = new ArcRotateCamera(
    'follow',
    -(facing0 + Math.PI / 2),
    DEFAULT_BETA,
    DEFAULT_RADIUS,
    new Vector3(spawn.x, y0 + TARGET_HEIGHT, spawn.z),
    scene
  );
  camera.lowerRadiusLimit = 4.2;
  camera.upperRadiusLimit = 10.5;
  camera.lowerBetaLimit = 1.08;
  camera.upperBetaLimit = 1.48;
  camera.fov = 0.92;
  camera.pinchPrecision = 80;
  camera.wheelPrecision = 40;
  camera.panningSensibility = 0;
  camera.inputs.clear();
  camera.minZ = 0.12;
  camera.maxZ = 400;
  // Own damping: the stock inertia fights direct radius/target writes and pops.
  camera.inertia = 0;
  camera.targetScreenOffset.y = 0.22;
  scene.activeCamera = camera;

  let locked = false;
  let desiredRadius = DEFAULT_RADIUS;
  let desiredBeta = DEFAULT_BETA;
  let camRadius = DEFAULT_RADIUS;
  let lookYaw = facing0;
  let lookAheadAmt = LOOK_AHEAD;
  let talkFraming = false;
  let easeFromTalk = 0;
  let occHold = 0;
  let pulledRadius = DEFAULT_RADIUS;
  const target = new Vector3(spawn.x, y0 + TARGET_HEIGHT, spawn.z);
  const fader = new OcclusionFader();
  const chest = new Vector3();

  const getPosition = () => character.root.getAbsolutePosition();

  const snapFollow = () => {
    const p = character.root.getAbsolutePosition();
    lookYaw = character.root.rotation.y;
    lookAheadAmt = LOOK_AHEAD * 0.35;
    target.set(p.x + Math.sin(lookYaw) * lookAheadAmt, p.y + TARGET_HEIGHT, p.z + Math.cos(lookYaw) * lookAheadAmt);
  };

  const setPosition = (x: number, y: number, z: number) => {
    character.root.position.set(x, y, z);
    snapFollow();
    aim(target);
  };

  const setView = (alpha: number, beta: number, radius: number) => {
    camera.alpha = alpha;
    const b = Math.min(camera.upperBetaLimit!, Math.max(camera.lowerBetaLimit!, beta));
    desiredBeta = b;
    camera.beta = b;
    desiredRadius = Math.min(camera.upperRadiusLimit!, Math.max(camera.lowerRadiusLimit!, radius));
    camRadius = desiredRadius;
    camera.radius = desiredRadius;
    pulledRadius = desiredRadius;
  };

  function smoothFollowTarget(dt: number, moving: boolean, facingYaw: number): void {
    const p = character.root.getAbsolutePosition();
    const yawK = 1 - Math.exp(-LOOK_YAW_SMOOTH * dt);
    if (moving) {
      lookYaw = lerpAngle(lookYaw, facingYaw, yawK);
      lookAheadAmt = expLerp(lookAheadAmt, LOOK_AHEAD, 5.5, dt);
    } else {
      lookAheadAmt = expLerp(lookAheadAmt, LOOK_AHEAD * 0.4, 2.4, dt);
    }
    const dx = p.x + Math.sin(lookYaw) * lookAheadAmt;
    const dy = p.y + TARGET_HEIGHT;
    const dz = p.z + Math.cos(lookYaw) * lookAheadAmt;
    target.x = expLerp(target.x, dx, TARGET_SMOOTH, dt);
    target.y = expLerp(target.y, dy, TARGET_SMOOTH, dt);
    target.z = expLerp(target.z, dz, TARGET_SMOOTH, dt);
  }

  /** Move the aim point without letting Babylon rebuild alpha/beta/radius. */
  function aim(at: Vector3): void {
    camera.setTarget(at, false, true, true);
  }

  const savedLimits = {
    loB: camera.lowerBetaLimit,
    upB: camera.upperBetaLimit,
    loR: camera.lowerRadiusLimit,
    upR: camera.upperRadiusLimit
  };

  const hiddenTalk: Array<{ mesh: AbstractMesh; vis: boolean }> = [];
  const savedPlayer = { x: 0, y: 0, z: 0 };

  const clutterName =
    /bamboo|rockery|scholars-stone|peony|planter|lotus-cluster|lantern|pavilion|bell|drum|stool|bench|incense|guqin|tea|cushion|balustrade|walkway|plum|bonsai|tuft|verge|flower|column/i;
  const keepName =
    /char:|player|paving|palace-wall|ceremonial-hall|gate-tower|throne|sky|sea|ql-|hem|chest|head|sleeve|robe|kangxi|yongzheng|qianlong|manchu|han|official|farmer|soldier|heshen/i;

  function hideTalkClutter(cam: Vector3, npc: Vector3): void {
    hiddenTalk.length = 0;
    const sc = character.root.getScene();
    for (const mesh of sc.meshes) {
      const label = `${mesh.name} ${mesh.parent?.name ?? ''}`;
      if (keepName.test(label)) continue;
      let center: Vector3;
      try {
        center = mesh.getBoundingInfo().boundingBox.centerWorld;
      } catch {
        continue;
      }
      const nearNpc = Vector3.Distance(center, npc) < 7.5;
      const nearCam = Vector3.Distance(center, cam) < 6;
      const mid = cam.add(npc).scale(0.5);
      const onLine = Vector3.Distance(center, mid) < 4.2 && center.y > 0.25;
      if (!(nearNpc || nearCam || onLine)) continue;
      if (!clutterName.test(label) && !onLine) continue;
      if (/paving|floor|ground|verge/i.test(label) && center.y < 0.4) continue;
      hiddenTalk.push({ mesh, vis: mesh.isVisible });
      mesh.isVisible = false;
    }
  }

  const beginTalkFrame = (npc: Vector3, facing?: number) => {
    talkFraming = true;
    easeFromTalk = 0;
    const p0 = character.root.getAbsolutePosition();
    savedPlayer.x = p0.x;
    savedPlayer.y = p0.y;
    savedPlayer.z = p0.z;
    const yaw = facing ?? Math.atan2(p0.x - npc.x, p0.z - npc.z);
    const front = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const head = new Vector3(npc.x, npc.y + 1.48, npc.z);

    const sidePos = new Vector3(npc.x + front.x * 1.3 + side.x * 1.8, p0.y, npc.z + front.z * 1.3 + side.z * 1.8);
    const resolved = grid.resolve(sidePos.x, sidePos.z);
    character.root.position.set(resolved.x, grid.heightAt(resolved.x, resolved.z, FOOT_R), resolved.z);

    const tryCam = (sideSign: number, dist: number, hy: number) =>
      head.add(front.scale(dist)).add(side.scale(sideSign)).add(new Vector3(0, hy - 1.48, 0));
    const candidates = [
      tryCam(-1.05, 4.2, 1.95),
      tryCam(1.05, 4.2, 1.95),
      tryCam(-1.45, 4.8, 2.15),
      tryCam(1.45, 4.8, 2.15),
      tryCam(-0.55, 3.8, 1.85),
      tryCam(1.4, 5.2, 2.25)
    ];
    let camPos = candidates[0];
    for (const c of candidates) {
      if (!grid.hitsCamera(c.x, c.y, c.z)) {
        camPos = c;
        break;
      }
    }
    hideTalkClutter(camPos, head);

    const to = camPos.subtract(head);
    const radius = Math.max(3.6, Math.min(6.2, to.length()));
    const beta = Math.acos(Math.min(0.95, Math.max(0.12, to.y / Math.max(0.001, radius))));
    const alpha = Math.atan2(to.z, to.x);
    camera.lowerBetaLimit = 0.7;
    camera.upperBetaLimit = 1.55;
    camera.lowerRadiusLimit = 3.2;
    camera.upperRadiusLimit = 8.5;
    camera.targetScreenOffset.y = -0.28;
    camera.targetScreenOffset.x = 0.08;
    aim(head);
    setView(alpha, beta, radius);
  };

  const endTalkFrame = () => {
    talkFraming = false;
    for (const h of hiddenTalk) h.mesh.isVisible = h.vis;
    hiddenTalk.length = 0;
    camera.lowerBetaLimit = savedLimits.loB;
    camera.upperBetaLimit = savedLimits.upB;
    camera.lowerRadiusLimit = savedLimits.loR;
    camera.upperRadiusLimit = savedLimits.upR;
    desiredRadius = DEFAULT_RADIUS;
    desiredBeta = DEFAULT_BETA;
    lookYaw = character.root.rotation.y;
    lookAheadAmt = LOOK_AHEAD * 0.4;
    const p = character.root.getAbsolutePosition();
    target.set(p.x, p.y + TARGET_HEIGHT, p.z);
    aim(target);
    easeFromTalk = 0.55;
  };

  function followCamera(dt: number): void {
    aim(target);

    const ox = Math.cos(camera.alpha) * Math.sin(camera.beta);
    const oy = Math.cos(camera.beta);
    const oz = Math.sin(camera.alpha) * Math.sin(camera.beta);
    let hitR = desiredRadius;
    for (let t = 2.2; t <= desiredRadius; t += 0.25) {
      if (grid.hitsCamera(target.x + ox * t, target.y + oy * t, target.z + oz * t)) {
        hitR = Math.max(4.2, t - 0.35);
        break;
      }
    }
    if (hitR < desiredRadius - OCC_MARGIN) {
      occHold = OCC_HOLD;
      pulledRadius = hitR;
    } else if (occHold > 0) {
      occHold -= dt;
    } else {
      pulledRadius = desiredRadius;
    }
    const goalR = Math.min(desiredRadius, occHold > 0 ? pulledRadius : desiredRadius, hitR);
    const rate = goalR < camRadius - 0.05 ? RADIUS_IN : RADIUS_OUT;
    camRadius = expLerp(camRadius, goalR, rate, dt);
    camera.radius = camRadius;

    const loB = camera.lowerBetaLimit ?? 1.08;
    const upB = camera.upperBetaLimit ?? 1.48;
    const clamped = Math.min(upB, Math.max(loB, desiredBeta));
    camera.beta = expLerp(camera.beta, clamped, BETA_SMOOTH, dt);
  }

  function updateFade(dt: number): void {
    const p = character.root.getAbsolutePosition();
    chest.set(p.x, p.y + 1.25, p.z);
    // Fade along the real eye → chest segment, not the look-ahead camera target.
    const eye = camera.globalPosition ?? camera.position;
    fader.update(scene, eye, chest, dt, true);
  }

  const update = (dt: number) => {
    if (talkFraming) {
      character.setMove(0, dt);
      updateFade(dt);
      return;
    }
    if (easeFromTalk > 0) {
      easeFromTalk = Math.max(0, easeFromTalk - dt);
      const u = 1 - easeFromTalk / 0.55;
      const k = u * u * (3 - 2 * u);
      camera.targetScreenOffset.y = -0.28 + (0.22 - -0.28) * k;
      camera.targetScreenOffset.x = 0.08 * (1 - k);
    }

    if (locked || hud.isModalOpen) {
      character.setMove(0, dt);
      if (!locked) {
        smoothFollowTarget(dt, false, character.root.rotation.y);
        followCamera(dt);
        updateFade(dt);
      }
      return;
    }

    const look = input.consumeLook();
    if (look.yaw || look.pitch) {
      camera.alpha -= look.yaw;
      const loB = camera.lowerBetaLimit ?? 1.08;
      const upB = camera.upperBetaLimit ?? 1.48;
      camera.beta = Math.min(upB, Math.max(loB, camera.beta + look.pitch));
      desiredBeta = camera.beta;
    }

    const key = input.keyboardAxis();
    const stick = joystick.value;
    let mx = key.x + stick.x;
    let mz = key.z + stick.y;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }

    const dir = camera.getForwardRay().direction;
    const moveV = cameraRelativeMove(dir.x, dir.z, mx, mz);
    const move = new Vector3(moveV.x, 0, moveV.z);

    let speedNow = 0;
    let moving = false;
    if (move.lengthSquared() > 0.0004) {
      move.normalize();
      const step = speed * dt;
      let nx = character.root.position.x + move.x * step;
      let nz = character.root.position.z + move.z * step;
      const resolved = grid.resolve(nx, nz);
      nx = resolved.x;
      nz = resolved.z;
      const hy = grid.heightAt(nx, nz, FOOT_R);
      character.root.position.set(nx, hy, nz);
      character.setFacing(Math.atan2(move.x, move.z));
      speedNow = speed;
      moving = true;
    }
    character.setMove(speedNow, dt);

    smoothFollowTarget(dt, moving, character.root.rotation.y);
    followCamera(dt);
    updateFade(dt);
  };

  const setLocked = (v: boolean) => {
    locked = v;
  };

  const parentTo = (node: TransformNode | null) => {
    if (node) {
      const world = character.root.getAbsolutePosition();
      character.root.parent = node;
      const inv = node.getWorldMatrix().clone();
      inv.invert();
      character.root.position.copyFrom(Vector3.TransformCoordinates(world, inv));
    } else {
      const world = character.root.getAbsolutePosition();
      character.root.parent = null;
      character.root.position.copyFrom(world);
    }
  };

  const dispose = () => {
    fader.restore();
    character.dispose();
    camera.dispose();
  };

  void canvas;
  return {
    character,
    camera,
    getPosition,
    setPosition,
    setView,
    beginTalkFrame,
    endTalkFrame,
    update,
    setLocked,
    parentTo,
    dispose
  };
}
