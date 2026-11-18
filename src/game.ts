import { Engine, Scene } from '@babylonjs/core';
import {
  HINTS,
  LESSON_SUMMARY,
  LOCKED_DOOR,
  PASSWORDS,
  QUIZZES,
  STAGE_NAMES
} from './data/content';
import { bindVisualViewport, Input } from './engine/input';
import { createEngine, createGameScene } from './engine/sceneSetup';
import { clearMaterialCaches } from './engine/materials';
import { HUD } from './ui/hud';
import { Minimap, type MinimapActor, type MinimapDot } from './ui/minimap';
import { Joystick } from './ui/joystick';
import { showDialogue, showMessage, showPassword, showQuiz, showSummary, showTitle, updateTitleProgress } from './ui/modals';
import { loadKangxiStage } from './stages/stageKangxi';
import { loadYongzhengStage } from './stages/stageYongzheng';
import { loadQianlongStage, unlockShipApproach } from './stages/stageQianlong';
import type { Interactable, StageHandle, StageId } from './stages/types';
import { dumpWalkScene } from './engine/qaDump';
import { Animation, Vector3 } from '@babylonjs/core';

export class Game {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private hud: HUD;
  private input: Input;
  private joystick: Joystick;
  private unbindVv: () => void;
  private stage: StageHandle | null = null;
  private scene: Scene | null = null;
  private stageId: StageId | null = null;
  private running = false;
  private lastTime = 0;
  private nearest: Interactable | null = null;
  private boarded = false;
  private started = false;
  private minimap: Minimap;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.engine = createEngine(canvas);
    this.hud = new HUD(uiRoot);
    this.minimap = new Minimap(this.hud.root);
    this.minimap.setVisible(false);
    this.input = new Input(canvas);
    this.joystick = new Joystick(this.hud.joystickEl, this.hud.knobEl);
    this.unbindVv = bindVisualViewport();
    this.hud.onTalk(() => this.tryInteract());
    window.addEventListener('resize', () => this.engine.resize());
  }

  async boot(): Promise<void> {
    this.running = true;
    this.hud.setTitleMode(true);
    this.engine.runRenderLoop(() => this.tick());

    // Lightweight preloader scene (no heavy GLB yet)
    const bootScene = createGameScene(this.engine, {
      clear: '#6AA4D4',
      fog: '#A8C8E0',
      fogStart: 160,
      fogEnd: 320
    });
    this.scene = bootScene;
    bootScene.fogMode = 0;
    const { FreeCamera } = await import('@babylonjs/core/Cameras/freeCamera');
    const { Vector3: V3, HemisphericLight, Color3, Color4 } = await import('@babylonjs/core');
    const { buildImperialBarge } = await import('./props/imperialBarge');
    // 3/4 beauty shot: gold cabin and sails sit in the upper half, above the lowered title card.
    const cam = new FreeCamera('boot-cam', new V3(16, 8.2, 16), bootScene);
    cam.setTarget(new V3(0, 3.4, 0));
    bootScene.activeCamera = cam;
    bootScene.clearColor = new Color4(0.42, 0.65, 0.86, 1);
    new HemisphericLight('boot-hemi', new V3(0.2, 1, 0.25), bootScene).intensity = 0.78;
    const { DirectionalLight } = await import('@babylonjs/core');
    const sun = new DirectionalLight('boot-sun', new V3(-0.4, -1, 0.35), bootScene);
    sun.intensity = 1.25;
    sun.diffuse = new Color3(1, 0.97, 0.9);
    const barge = buildImperialBarge(bootScene, 'boot-barge', 1);
    barge.root.position.set(0, 0.05, 0);
    barge.root.rotation.y = -0.62;
    const { addTitleHaze, addSkyDome } = await import('./engine/sceneSetup');
    addSkyDome(bootScene, '#2F74C4', '#B7D4EE', 400);
    addTitleHaze(bootScene);
    const { buildSea } = await import('./props/props');
    buildSea(bootScene, 'boot-sea', 120, 120, { centerX: 0, centerZ: 0, y: -0.35, shoreX: -70 });
    bootScene.onBeforeRenderObservable.add(() => {
      barge.root.rotation.y += 0.00045;
      barge.root.position.y = Math.sin(performance.now() * 0.0008) * 0.05;
    });

    let startResolve: () => void;
    const started = new Promise<void>((r) => (startResolve = r));
    showTitle(this.hud, {
      progress: 0.05,
      status: '正在載入康熙庭院……',
      ready: false,
      onStart: () => {
        this.started = true;
        startResolve();
      }
    });
    await this.hud.fadeFromBlack(300);

    // Preload stage 1 into a new scene in the background? We'll swap after Start.
    // Keep the title up; actual load of Kangxi happens after start to hold memory.
    updateTitleProgress(this.hud, 1, '載入完成，可以開始。', true);
    await started;
    await this.hud.fadeToBlack(350);
    barge.root.dispose();
    bootScene.dispose();
    clearMaterialCaches();
    await this.goto('kangxi', true);
  }

  private async goto(id: StageId, first = false): Promise<void> {
    this.stage?.dispose();
    this.scene?.dispose();
    this.stage = null;
    this.minimap.setSchema(null);
    this.minimap.setVisible(false);
    this.boarded = false;

    const clear = id === 'yongzheng' ? '#C5D4E2' : id === 'qianlong' ? '#8FBFDC' : '#9EC8E6';
    const scene = createGameScene(this.engine, {
      clear,
      fog: clear,
      fogStart: id === 'qianlong' ? 70 : 36,
      fogEnd: id === 'qianlong' ? 200 : 110
    });
    this.scene = scene;
    this.stageId = id;

    const label = id === 'kangxi' ? '正在進入康熙庭院……' : id === 'yongzheng' ? '正在進入雍正大殿……' : '正在進入乾隆年間……';
    this.hud.showModal(`<div class="sheet"><h2>載入中</h2><p class="sub" id="load-msg">${label}</p><div class="progress-track"><div class="progress-fill" id="boot-fill" style="width:8%"></div></div></div>`);
    const onProgress = (p: number, msg: string) => {
      this.hud.setQuest(msg);
      const fill = this.hud.modalEl.querySelector('#boot-fill') as HTMLElement | null;
      const st = this.hud.modalEl.querySelector('#load-msg') as HTMLElement | null;
      if (fill) fill.style.width = `${Math.round(p * 100)}%`;
      if (st) st.textContent = msg || label;
    };

    const loader =
      id === 'kangxi' ? loadKangxiStage : id === 'yongzheng' ? loadYongzhengStage : loadQianlongStage;
    const stage = await loader(scene, this.canvas, this.input, this.joystick, this.hud, onProgress);
    this.stage = stage;
    this.minimap.setSchema(stage.minimap ?? null);
    this.hud.hideModal();
    this.hud.setTitleMode(false);
    this.refreshQuest();
    this.applyStrength();
    if (first) {
      this.hud.setPrompt(HINTS.move);
      setTimeout(() => {
        if (this.stageId === 'kangxi' && this.hud.promptEl.textContent === HINTS.move) {
          this.hud.setPrompt(null);
        }
      }, 7000);
    }
    await this.hud.fadeFromBlack(450);
    scene.blockMaterialDirtyMechanism = true;
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.05, this.lastTime ? (now - this.lastTime) / 1000 : 0.016);
    this.lastTime = now;
    if (!this.running) return;
    const scene = this.scene;
    const stage = this.stage;
    if (scene && scene.activeCamera) {
      if (stage && this.started) {
        stage.player.update(dt);
        stage.update?.(dt);
        this.updateInteract(dt);
        this.applyStrength();
        this.updateMinimap();
        if (this.input.consumeInteract()) this.tryInteract();
      }
      scene.render();
    }
  }

  private updateInteract(_dt: number): void {
    const stage = this.stage;
    if (!stage || this.hud.isModalOpen || this.boarded) return;
    const p = stage.player.getPosition();
    let best: Interactable | null = null;
    let bestD = 1e9;
    for (const it of stage.interactables) {
      const q = it.getPosition();
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.nearest = best;
    if (!best) {
      this.hud.setPrompt(null);
      this.hud.setTalkEnabled(false);
      return;
    }
    const label =
      best.kind === 'door'
        ? '出口'
        : best.kind === 'ship'
          ? '登上御船'
          : best.kind === 'investigate'
            ? `調查：${best.title}`
            : `傾談：${best.title}`;
    this.hud.setPrompt(label);
    const shipLocked = best.kind === 'ship' && !stage.passwordDone;
    this.hud.setTalkEnabled(!shipLocked, !best.talked || best.kind === 'door' || best.kind === 'ship');
  }

  private pickNearest(): Interactable | null {
    const stage = this.stage;
    if (!stage) return null;
    const p = stage.player.getPosition();
    let best: Interactable | null = null;
    let bestD = 1e9;
    for (const it of stage.interactables) {
      const q = it.getPosition();
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  private tryInteract(forceId?: string): void {
    const stage = this.stage;
    const id = this.stageId;
    if (!stage || !id || this.hud.isModalOpen || this.boarded) return;
    const it = (forceId ? stage.interactables.find((i) => i.id === forceId) : null) ?? this.pickNearest() ?? this.nearest;
    if (!it) return;

    if (it.kind === 'door') {
      this.handleDoor();
      return;
    }
    if (it.kind === 'ship') {
      this.handleShip();
      return;
    }
    if (it.talked && it.pages) {
      this.frameTalk(it);
      showDialogue(this.hud, it.pages, () => {
        stage.player.endTalkFrame();
        this.refreshQuest();
      });
      return;
    }
    if (it.pages && it.pages.length) {
      this.frameTalk(it);
      showDialogue(this.hud, it.pages, () => {
        stage.player.endTalkFrame();
        it.talked = true;
        it.character?.markTalked(true);
        this.refreshQuest();
        if (this.allRequiredDone(stage) && !stage.quizDone) {
          showMessage(this.hud, '證據已齊全', HINTS.quizReady);
        }
      });
    }
  }

  private frameTalk(it: Interactable): void {
    const stage = this.stage;
    if (!stage) return;
    const q = it.getPosition();
    const facing = it.character?.root.rotation.y;
    stage.player.beginTalkFrame(new Vector3(q.x, q.y, q.z), facing);
  }

  private updateMinimap(): void {
    const stage = this.stage;
    const talkOpen = this.hud.modalEl.classList.contains('talk-frame');
    const show = !!stage && this.started && !this.boarded && (!this.hud.isModalOpen || talkOpen);
    this.minimap.setVisible(show);
    if (!show || !stage) return;
    const p = stage.player.getPosition();
    const player: MinimapActor = {
      x: p.x,
      z: p.z,
      facing: stage.player.character.root.rotation.y,
      role: 'player'
    };
    const others: MinimapActor[] = [];
    const extras: MinimapDot[] = [];
    for (const it of stage.interactables) {
      const pos = it.getPosition();
      if (it.character) {
        const emp = /kangxi|yongzheng|qianlong/.test(it.id);
        others.push({ x: pos.x, z: pos.z, role: emp ? 'emperor' : 'npc' });
      } else if (it.kind === 'door' || it.kind === 'ship') {
        extras.push({ x: pos.x, z: pos.z, kind: 'exit' });
      } else {
        extras.push({ x: pos.x, z: pos.z, kind: 'item' });
      }
    }
    this.minimap.update(player, others, extras);
  }

  private allRequiredDone(stage: StageHandle): boolean {
    return stage.requiredIds.every((rid) => stage.interactables.find((i) => i.id === rid)?.talked);
  }

  private handleDoor(): void {
    const stage = this.stage!;
    const id = this.stageId!;
    if (!this.allRequiredDone(stage)) {
      showMessage(this.hud, '出口仍然鎖上', LOCKED_DOOR[id]);
      return;
    }
    if (!stage.quizDone) {
      showQuiz(this.hud, QUIZZES[id], () => {
        stage.quizDone = true;
        this.refreshQuest();
        showMessage(this.hud, '全部答對了', '請在出口輸入密碼，繼續行程。', '輸入密碼', () => this.openPassword());
      });
      return;
    }
    if (!stage.passwordDone) {
      this.openPassword();
      return;
    }
    this.advanceAfterPassword();
  }

  private openPassword(): void {
    const id = this.stageId!;
    const expected = PASSWORDS[id];
    showPassword(
      this.hud,
      expected,
      '請輸入密碼',
      '答對題目後，請輸入老師提供的三位數密碼。',
      () => {
        this.stage!.passwordDone = true;
        this.refreshQuest();
        this.advanceAfterPassword();
      }
    );
  }

  private async advanceAfterPassword(): Promise<void> {
    const id = this.stageId!;
    if (id === 'kangxi') {
      await this.hud.fadeToBlack();
      await this.goto('yongzheng');
      return;
    }
    if (id === 'yongzheng') {
      await this.hud.fadeToBlack();
      await this.goto('qianlong');
      return;
    }
    // Qianlong: unlock boarding
    unlockShipApproach(this.stage!);
    showMessage(this.hud, '密碼正確', HINTS.boardReady);
  }

  private handleShip(): void {
    const stage = this.stage!;
    if (!this.allRequiredDone(stage)) {
      showMessage(this.hud, '還不能登船', LOCKED_DOOR.qianlong);
      return;
    }
    if (!stage.quizDone) {
      showQuiz(this.hud, QUIZZES.qianlong, () => {
        stage.quizDone = true;
        this.refreshQuest();
        showMessage(this.hud, '全部答對了', '請輸入密碼，然後登上御船。', '輸入密碼', () => this.openPassword());
      });
      return;
    }
    if (!stage.passwordDone) {
      this.openPassword();
      return;
    }
    void this.playDeparture();
  }

  private async playDeparture(): Promise<void> {
    const stage = this.stage!;
    const scene = this.scene!;
    if (this.boarded) return;
    this.boarded = true;
    this.hud.setTalkEnabled(false);
    this.hud.setPrompt('御船正在開出……');
    this.hud.hidePlayControls(true);
    stage.player.setLocked(true);

    const ship = scene.getTransformNodeByName('flagship');
    const cam = stage.player.camera;
    cam.parent = null;
    cam.targetScreenOffset.y = 0.2;
    if (ship) {
      const meta = (ship.metadata ?? {}) as { meshyDeckY?: number; meshyCamY?: number; meshyCamR?: number };
      const deck = new Vector3(0, meta.meshyDeckY ?? 1.9, 4);
      stage.player.character.root.parent = ship;
      stage.player.character.root.position.copyFrom(deck);
      stage.player.character.setFacing(0);

      const frameShip = () => {
        const mid = ship.getAbsolutePosition().add(new Vector3(0, meta.meshyCamY ?? 2.8, 0));
        cam.setTarget(mid, false, true, true);
        // World-space 3/4 view: hull, decks, banners and the water around the ship.
        cam.alpha = -0.95;
        cam.beta = 1.18;
        cam.radius = meta.meshyCamR ?? 24;
      };
      frameShip();
      const obs = scene.onBeforeRenderObservable.add(() => {
        if (!this.boarded) {
          scene.onBeforeRenderObservable.remove(obs);
          return;
        }
        frameShip();
      });

      const startX = ship.position.x;
      const startZ = ship.position.z;
      const anim = new Animation('sail', 'position', 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
      anim.setKeys([
        { frame: 0, value: new Vector3(startX, ship.position.y, startZ) },
        { frame: 240, value: new Vector3(startX + 22, ship.position.y, startZ + 1.5) }
      ]);
      ship.animations = [anim];
      scene.beginAnimation(ship, 0, 240, false, 1);
    }

    this.applyStrength();
    await new Promise((r) => setTimeout(r, 2600));
    showSummary(this.hud, LESSON_SUMMARY, () => {
      this.hud.setQuest('探索完成。早期康雍乾治國有方，國勢強盛；乾隆晚年國勢轉弱。', '完成');
      this.hud.setPrompt(null);
    });
  }

  private refreshQuest(): void {
    const stage = this.stage;
    const id = this.stageId;
    if (!stage || !id) return;
    const done = stage.requiredIds.filter((rid) => stage.interactables.find((i) => i.id === rid)?.talked).length;
    const total = stage.requiredIds.length;
    const names = stage.requiredIds
      .map((rid) => {
        const it = stage.interactables.find((i) => i.id === rid);
        const mark = it?.talked ? '✓' : '○';
        const short = (it?.title ?? rid).split('（')[0];
        return `${mark}${short}`;
      })
      .join('　');
    let extra = '';
    if (done < total) extra = `已傾談／調查 <b>${done}/${total}</b>。${names}`;
    else if (!stage.quizDone) extra = `<b>證據已齊全。</b>請到出口回答三條問題。`;
    else if (!stage.passwordDone) extra = `<b>已答對題目。</b>請在出口輸入密碼。`;
    else if (id === 'qianlong' && !this.boarded) extra = `<b>密碼正確。</b>請走到大船邊，登上南巡御船。`;
    else extra = names;
    this.hud.setQuest(`${STAGE_NAMES[id]}　${extra}`);
  }

  private applyStrength(): void {
    const stage = this.stage;
    if (!stage) return;
    if (this.boarded) {
      this.hud.setStrength(0.36, 'weak');
      return;
    }
    const p = stage.player.getPosition();
    const s = stage.strengthAt ? stage.strengthAt(p.x, p.z) : { value: 0.78, kind: 'strong' as const };
    this.hud.setStrength(s.value, s.kind);
  }

  dispose(): void {
    this.running = false;
    this.stage?.dispose();
    this.scene?.dispose();
    this.engine.dispose();
    this.input.dispose();
    this.joystick.dispose();
    this.unbindVv();
  }
}

/** Optional QA hook used only with ?qa=1 for layout screenshots and playthrough. */
export function installQaHook(game: Game): void {
  const g = game as unknown as {
    stage: StageHandle | null;
    stageId: StageId | null;
    tryInteract: (id?: string) => void;
    handleDoor: () => void;
    goto: (id: StageId) => Promise<void>;
    hud: HUD;
  };
  (window as unknown as { __qing: unknown }).__qing = {
    pos: () => {
      const p = g.stage?.player.getPosition();
      return p ? { x: p.x, y: p.y, z: p.z } : null;
    },
    teleport: (x: number, z: number) => {
      if (!g.stage) return;
      const y = g.stage.grid.heightAt(x, z);
      g.stage.player.setPosition(x, y, z);
    },
    face: (radians: number) => g.stage?.player.character.setFacing(radians),
    look: (alpha: number, beta?: number, radius?: number) => {
      const stage = g.stage;
      if (!stage) return;
      stage.player.setView(alpha, beta ?? stage.player.camera.beta, radius ?? stage.player.camera.radius);
    },
    talkNearest: (id?: string) => g.tryInteract(id),
    goto: (id: string) => g.goto(id as StageId),
    lock: (v: boolean) => g.stage?.player.setLocked(v),
    rawLook: (alpha: number, beta: number, radius: number) => {
      const stage = g.stage;
      if (!stage) return;
      const cam = stage.player.camera;
      cam.lowerBetaLimit = 0.05;
      cam.upperBetaLimit = 1.57;
      cam.lowerRadiusLimit = 1;
      cam.upperRadiusLimit = 80;
      stage.player.setView(alpha, beta, radius);
    },
    aim: (x: number, y: number, z: number, alpha: number, beta: number, radius: number) => {
      const stage = g.stage;
      if (!stage) return;
      stage.player.setLocked(true);
      const cam = stage.player.camera;
      cam.lowerBetaLimit = 0.05;
      cam.upperBetaLimit = 1.57;
      cam.lowerRadiusLimit = 1;
      cam.upperRadiusLimit = 80;
      cam.setTarget(new Vector3(x, y, z), false, true, true);
      stage.player.setView(alpha, beta, radius);
    },
    gotoNear: (id: string) => {
      const it = g.stage?.interactables.find((i) => i.id === id);
      if (!it || !g.stage) return false;
      const q = it.getPosition();
      const yaw = it.character?.root.rotation.y ?? 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const spot = g.stage.grid.firstOpenOffset(q.x, q.z, [
        [fx * 1.7, fz * 1.7],
        [fx * 1.7 + 1.1, fz * 1.7],
        [fx * 1.7 - 1.1, fz * 1.7],
        [0, -1.7],
        [0, 1.7],
        [1.7, 0],
        [-1.7, 0],
        [1.3, 1.3],
        [-1.3, 1.3],
        [1.3, -1.3],
        [-1.3, -1.3]
      ]);
      const x = spot?.x ?? q.x;
      const z = spot?.z ?? q.z + 1.6;
      const y = g.stage.grid.heightAt(x, z);
      g.stage.player.setPosition(x, y, z);
      return true;
    },
    stage: () => g.stageId,
    required: () =>
      g.stage?.interactables.map((i) => ({ id: i.id, talked: i.talked, title: i.title, kind: i.kind })),
    modalOpen: () => g.hud.isModalOpen,
    dump: (opts?: { points?: Array<[number, number, string]>; regions?: Array<{ x0: number; x1: number; z0: number; z1: number; step: number; tag: string }> }) => {
      const stage = g.stage;
      if (!stage) return null;
      const scene = stage.player.camera.getScene();
      const data = dumpWalkScene(scene, { ...(opts ?? {}), grid: stage.grid });
      const p = stage.player.getPosition();
      const cam = stage.player.camera;
      return {
        stage: g.stageId,
        player: { x: p.x, y: p.y, z: p.z },
        cam: {
          alpha: cam.alpha,
          beta: cam.beta,
          radius: cam.radius,
          pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          global: cam.globalPosition
            ? { x: cam.globalPosition.x, y: cam.globalPosition.y, z: cam.globalPosition.z }
            : null,
          target: { x: cam.target.x, y: cam.target.y, z: cam.target.z }
        },
        grid: {
          solids: stage.grid.solids,
          platforms: stage.grid.platforms,
          ramps: stage.grid.ramps
        },
        ...data
      };
    },
    inspect: () => {
      const stage = g.stage;
      if (!stage) return null;
      const cam = stage.player.camera;
      const p = stage.player.getPosition();
      const scene = cam.getScene();
      const nearby = scene.meshes
        .filter((m) => {
          const q = m.getAbsolutePosition();
          return Math.abs(q.x - p.x) < 18 && Math.abs(q.z - p.z) < 18 && m.isEnabled();
        })
        .slice(0, 80)
        .map((m) => {
          const q = m.getAbsolutePosition();
          return { n: m.name, x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2) };
        });
      return {
        stage: g.stageId,
        pos: { x: p.x, y: p.y, z: p.z },
        facing: stage.player.character.root.rotation.y,
        cam: {
          alpha: cam.alpha,
          beta: cam.beta,
          radius: cam.radius,
          pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          target: { x: cam.target.x, y: cam.target.y, z: cam.target.z }
        },
        strength: document.querySelector('.strength-kind, #strength-label, .bar-label')?.textContent ??
          (document.querySelector('#hud') as HTMLElement | null)?.innerText?.slice(0, 200) ?? '',
        nearby
      };
    }
  };
}
