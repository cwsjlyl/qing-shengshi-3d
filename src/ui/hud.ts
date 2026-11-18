import { OPENING_TASK, TITLE } from '../data/content';

export type StrengthKind = 'strong' | 'peak' | 'weak';

export class HUD {
  root: HTMLElement;
  fadeEl: HTMLElement;
  taskEl: HTMLElement;
  strengthEl: HTMLElement;
  strengthFill: HTMLElement;
  strengthState: HTMLElement;
  questEl: HTMLElement;
  promptEl: HTMLElement;
  talkBtn: HTMLButtonElement;
  joystickEl: HTMLElement;
  knobEl: HTMLElement;
  modalEl: HTMLElement;
  private talkHandler: (() => void) | null = null;

  constructor(mount: HTMLElement) {
    mount.innerHTML = `
      <div id="fade"></div>
      <div id="title-haze" aria-hidden="true"></div>
      <header id="hud-top">
        <div id="task"><span class="kicker">探索任務</span>${escapeHtml(OPENING_TASK)}</div>
        <div id="strength">
          <div class="label">康雍乾盛世</div>
          <div class="track"><div class="fill" id="strength-fill"></div></div>
          <div class="state" id="strength-state">強盛</div>
        </div>
        <div id="quest"><span class="tag">進度</span><div class="body" id="quest-body">準備出發</div></div>
      </header>
      <div id="prompt"></div>
      <div id="joystick" aria-label="移動搖桿">
        <div class="base"><div class="knob"></div></div>
      </div>
      <button type="button" id="btn-talk" disabled>傾談／調查</button>
      <div id="modal" role="dialog" aria-modal="true"></div>
    `;
    this.root = mount;
    this.fadeEl = mount.querySelector('#fade')!;
    this.taskEl = mount.querySelector('#task')!;
    this.strengthEl = mount.querySelector('#strength')!;
    this.strengthFill = mount.querySelector('#strength-fill')!;
    this.strengthState = mount.querySelector('#strength-state')!;
    this.questEl = mount.querySelector('#quest-body')!;
    this.promptEl = mount.querySelector('#prompt')!;
    this.talkBtn = mount.querySelector('#btn-talk')!;
    this.joystickEl = mount.querySelector('#joystick')!;
    this.knobEl = mount.querySelector('#joystick .knob')!;
    this.modalEl = mount.querySelector('#modal')!;

    this.talkBtn.addEventListener('click', () => this.talkHandler?.());
    this.setStrength(0.78, 'strong');
  }

  onTalk(fn: () => void): void {
    this.talkHandler = fn;
  }

  setQuest(html: string, tag = '進度'): void {
    const tagEl = this.root.querySelector('#quest .tag');
    if (tagEl) tagEl.textContent = tag;
    this.questEl.innerHTML = html;
  }

  setStrength(value01: number, kind: StrengthKind): void {
    const v = Math.min(1, Math.max(0, value01));
    this.strengthFill.style.width = `${Math.round(v * 100)}%`;
    this.strengthEl.classList.remove('peak', 'weak');
    if (kind === 'peak') this.strengthEl.classList.add('peak');
    if (kind === 'weak') this.strengthEl.classList.add('weak');
    this.strengthState.textContent = kind === 'peak' ? '鼎盛' : kind === 'weak' ? '轉弱' : '強盛';
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.remove('show');
      this.promptEl.textContent = '';
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.classList.add('show');
  }

  setTalkEnabled(on: boolean, readyPulse = false): void {
    this.talkBtn.disabled = !on;
    this.talkBtn.classList.toggle('ready', on && readyPulse);
  }

  showModal(html: string): void {
    this.modalEl.innerHTML = html;
    this.modalEl.classList.add('show');
    document.body.classList.add('modal-open');
  }

  hideModal(): void {
    this.modalEl.classList.remove('show', 'airy', 'talk-frame', 'boot-title');
    this.modalEl.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  get isModalOpen(): boolean {
    return this.modalEl.classList.contains('show');
  }

  async fadeToBlack(ms = 400): Promise<void> {
    this.fadeEl.classList.remove('off');
    await sleep(ms);
  }

  async fadeFromBlack(ms = 450): Promise<void> {
    // force paint
    this.fadeEl.classList.remove('off');
    await sleep(30);
    this.fadeEl.classList.add('off');
    await sleep(ms);
  }

  hidePlayControls(hide: boolean): void {
    this.joystickEl.style.display = hide ? 'none' : '';
    this.talkBtn.style.display = hide ? 'none' : '';
  }

  setTitleMode(on: boolean): void {
    document.body.classList.toggle('title-open', on);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

void TITLE;
