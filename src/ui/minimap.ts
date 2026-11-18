export type MinimapRectKind = 'building' | 'water' | 'platform';

export type MinimapRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: MinimapRectKind;
};

export type MinimapDot = { x: number; z: number; kind?: 'item' | 'exit' };

export type MinimapSchema = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  rects: MinimapRect[];
  items?: MinimapDot[];
};

export type MinimapActor = { x: number; z: number; facing?: number; role: 'player' | 'npc' | 'emperor' };

const COLORS = {
  panel: 'rgba(26, 18, 11, 0.55)',
  ground: 'rgba(214, 196, 150, 0.35)',
  building: 'rgba(92, 36, 28, 0.88)',
  water: 'rgba(46, 92, 96, 0.8)',
  platform: 'rgba(126, 108, 72, 0.85)',
  item: '#e6c35c',
  exit: '#f4e8c8',
  npc: '#d4a84a',
  emperor: '#f0d48a',
  player: '#c42a22'
};

export class Minimap {
  root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private schema: MinimapSchema | null = null;
  private cssSize = 120;

  constructor(mount: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'minimap';
    this.root.setAttribute('aria-label', '地圖');
    this.root.innerHTML = `<span class="cap">地圖</span><canvas width="240" height="240"></canvas>`;
    mount.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
  }

  setSchema(schema: MinimapSchema | null): void {
    this.schema = schema;
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  update(player: MinimapActor, others: MinimapActor[], extraItems: MinimapDot[] = []): void {
    const schema = this.schema;
    if (!schema || this.root.classList.contains('hidden')) return;
    const r = this.root.getBoundingClientRect();
    this.cssSize = Math.max(64, r.width || 120);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(this.cssSize * dpr);
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    const ctx = this.ctx;
    const W = this.canvas.width;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, W, W);

    const { minX, maxX, minZ, maxZ } = schema.bounds;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const pad = W * 0.07;
    const inner = W - pad * 2;
    const toX = (x: number) => pad + ((x - minX) / spanX) * inner;
    // North-up: larger world Z is toward the top of the map (screen up).
    const toY = (z: number) => pad + ((maxZ - z) / spanZ) * inner;

    const fillRect = (rect: MinimapRect, color: string) => {
      const x0 = toX(rect.minX);
      const x1 = toX(rect.maxX);
      const y0 = toY(rect.maxZ);
      const y1 = toY(rect.minZ);
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0, Math.max(1.2, x1 - x0), Math.max(1.2, y1 - y0));
    };

    for (const rect of schema.rects) {
      if (rect.kind === 'water') fillRect(rect, COLORS.water);
    }
    for (const rect of schema.rects) {
      if (rect.kind === 'platform') fillRect(rect, COLORS.platform);
    }
    for (const rect of schema.rects) {
      if (rect.kind === 'building') fillRect(rect, COLORS.building);
    }

    const dots = [...(schema.items ?? []), ...extraItems];
    for (const d of dots) {
      ctx.beginPath();
      ctx.fillStyle = d.kind === 'exit' ? COLORS.exit : COLORS.item;
      ctx.arc(toX(d.x), toY(d.z), Math.max(2.2, W * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of others) {
      ctx.beginPath();
      ctx.fillStyle = n.role === 'emperor' ? COLORS.emperor : COLORS.npc;
      ctx.arc(toX(n.x), toY(n.z), Math.max(3.2, W * 0.028), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(26,18,11,0.7)';
      ctx.lineWidth = Math.max(1, W * 0.008);
      ctx.stroke();
    }

    // Player: facing arrow, north-up map so the arrow rotates.
    const pxp = toX(player.x);
    const pyp = toY(player.z);
    const yaw = player.facing ?? 0;
    // World facing 0 looks +Z (up on the map); screen angle is -yaw in canvas space
    // because +Z is -Y in screen, and yaw is from +Z toward +X.
    const ang = -yaw;
    const s = Math.max(5.5, W * 0.055);
    ctx.save();
    ctx.translate(pxp, pyp);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.58, s * 0.7);
    ctx.lineTo(0, s * 0.28);
    ctx.lineTo(-s * 0.58, s * 0.7);
    ctx.closePath();
    ctx.fillStyle = COLORS.player;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,220,0.9)';
    ctx.lineWidth = Math.max(1, W * 0.01);
    ctx.stroke();
    ctx.restore();
  }

  dispose(): void {
    this.schema = null;
    this.root.remove();
  }
}

export function rect(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  kind: MinimapRectKind = 'building'
): MinimapRect {
  return { minX, maxX, minZ, maxZ, kind };
}
