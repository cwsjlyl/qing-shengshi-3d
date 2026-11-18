export type LookDelta = { yaw: number; pitch: number };

export class Input {
  readonly keys = new Set<string>();
  moveX = 0;
  moveZ = 0;
  look: LookDelta = { yaw: 0, pitch: 0 };
  interactPressed = false;
  private canvas: HTMLCanvasElement;
  private looking = false;
  private lastX = 0;
  private lastY = 0;
  private lookSensitivity = 0.005;
  private unsubs: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bind();
  }

  private bind(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        if (!e.repeat) this.interactPressed = true;
        e.preventDefault();
      }
      const block = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
      if (block.includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase());
    };
    const onBlur = () => {
      this.keys.clear();
      this.looking = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('#ui-root') && t.closest('#joystick, #btn-talk, #modal, button, input')) {
        return;
      }
      this.looking = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.looking) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.look.yaw += dx * this.lookSensitivity;
      this.look.pitch += dy * this.lookSensitivity;
    };
    const onPointerUp = (e: PointerEvent) => {
      this.looking = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    this.unsubs.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('blur', onBlur),
      () => this.canvas.removeEventListener('pointerdown', onPointerDown),
      () => window.removeEventListener('pointermove', onPointerMove),
      () => window.removeEventListener('pointerup', onPointerUp),
      () => window.removeEventListener('pointercancel', onPointerUp)
    );
  }

  consumeInteract(): boolean {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  consumeLook(): LookDelta {
    const v = this.look;
    this.look = { yaw: 0, pitch: 0 };
    return v;
  }

  keyboardAxis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}

/** Keep HUD inside the visualViewport (iOS browser chrome, iPadOS, short embeds). */
export function bindVisualViewport(): () => void {
  const root = document.documentElement;
  const apply = () => {
    const vv = window.visualViewport;
    if (!vv) {
      root.style.setProperty('--vv-top', '0px');
      root.style.setProperty('--vv-bottom', '0px');
      root.style.setProperty('--vv-left', '0px');
      root.style.setProperty('--vv-right', '0px');
      return;
    }
    const top = Math.max(0, vv.offsetTop);
    const left = Math.max(0, vv.offsetLeft);
    const bottom = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
    const right = Math.max(0, window.innerWidth - (vv.offsetLeft + vv.width));
    root.style.setProperty('--vv-top', `${top}px`);
    root.style.setProperty('--vv-bottom', `${bottom}px`);
    root.style.setProperty('--vv-left', `${left}px`);
    root.style.setProperty('--vv-right', `${right}px`);
  };
  apply();
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  return () => {
    window.visualViewport?.removeEventListener('resize', apply);
    window.visualViewport?.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
  };
}
