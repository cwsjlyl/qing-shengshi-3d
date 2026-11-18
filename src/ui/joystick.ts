export type Stick = { x: number; y: number };

export class Joystick {
  value: Stick = { x: 0, y: 0 };
  private el: HTMLElement;
  private knob: HTMLElement;
  private pointerId: number | null = null;
  private unsubs: Array<() => void> = [];

  constructor(el: HTMLElement, knob: HTMLElement) {
    this.el = el;
    this.knob = knob;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.pointerId = e.pointerId;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.update(e);
    };
    const move = (e: PointerEvent) => {
      if (this.pointerId !== e.pointerId) return;
      e.preventDefault();
      this.update(e);
    };
    const up = (e: PointerEvent) => {
      if (this.pointerId !== e.pointerId && this.pointerId != null) return;
      this.pointerId = null;
      this.value = { x: 0, y: 0 };
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this.unsubs.push(
      () => el.removeEventListener('pointerdown', down),
      () => el.removeEventListener('pointermove', move),
      () => el.removeEventListener('pointerup', up),
      () => el.removeEventListener('pointercancel', up)
    );
  }

  private update(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width * 0.32;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / max;
    const ny = -dy / max;
    const dead = 0.12;
    this.value = {
      x: Math.abs(nx) < dead ? 0 : nx,
      y: Math.abs(ny) < dead ? 0 : ny
    };
  }

  dispose(): void {
    for (const u of this.unsubs) u();
  }
}
