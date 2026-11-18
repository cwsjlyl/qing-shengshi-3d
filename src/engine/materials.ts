import {
  Color3,
  PBRMaterial,
  Scene,
  StandardMaterial
} from '@babylonjs/core';

const stdCache = new Map<string, StandardMaterial>();
const pbrCache = new Map<string, PBRMaterial>();

function key(hex: string, extra = ''): string {
  return hex.toLowerCase() + '|' + extra;
}

export function hexColor(hex: string): Color3 {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return Color3.FromInts((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function stdMat(
  scene: Scene,
  hex: string,
  opts: { name?: string; specular?: number; emissive?: number; alpha?: number } = {}
): StandardMaterial {
  const k = key(hex, `${opts.specular ?? 0.18}|${opts.emissive ?? 0}|${opts.alpha ?? 1}`);
  const hit = stdCache.get(k);
  if (hit && hit.getScene() === scene) return hit;
  const m = new StandardMaterial(opts.name ?? `std:${hex}`, scene);
  const c = hexColor(hex);
  m.diffuseColor = c;
  const sp = opts.specular ?? 0.18;
  m.specularColor = new Color3(sp, sp * 0.92, sp * 0.8);
  m.specularPower = 36;
  if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
  if (opts.alpha != null && opts.alpha < 1) {
    m.alpha = opts.alpha;
    m.transparencyMode = 2;
  }
  m.freeze();
  stdCache.set(k, m);
  return m;
}

export function pbrMat(
  scene: Scene,
  hex: string,
  opts: { roughness?: number; metallic?: number; emissive?: number; name?: string } = {}
): PBRMaterial {
  const k = key(hex, `pbr|${opts.roughness ?? 0.55}|${opts.metallic ?? 0.04}|${opts.emissive ?? 0}`);
  const hit = pbrCache.get(k);
  if (hit && hit.getScene() === scene) return hit;
  const m = new PBRMaterial(opts.name ?? `pbr:${hex}`, scene);
  m.albedoColor = hexColor(hex);
  m.roughness = opts.roughness ?? 0.55;
  m.metallic = opts.metallic ?? 0.04;
  m.environmentIntensity = 0.55;
  if (opts.emissive) m.emissiveColor = hexColor(hex).scale(opts.emissive);
  m.freeze();
  pbrCache.set(k, m);
  return m;
}

export function clearMaterialCaches(): void {
  stdCache.clear();
  pbrCache.clear();
}

/** Skin / cloth palettes matching a stylised palace pack, not photoreal portraits. */
export const PALETTE = {
  skin: '#E6C2A0',
  skinDeep: '#C48A62',
  skinCheek: '#E8A090',
  hair: '#1A120E',
  eyeWhite: '#F4F0E8',
  irisDark: '#2A1C14',
  irisBrown: '#5A3418',
  kangxiRobe: '#E6B422',
  kangxiTrim: '#6B1020',
  yongzhengRobe: '#C9A227',
  yongzhengTrim: '#3A2410',
  qianlongRobe: '#F0C14A',
  qianlongTrim: '#8B1A1A',
  gold: '#D4A84A',
  goldBright: '#F0D27A',
  manchuRobe: '#1E3A6E',
  manchuTrim: '#C9A227',
  hanRobe: '#3D5C62',
  hanTrim: '#E8D8B0',
  officialA: '#5C4A32',
  officialB: '#6A3030',
  heshenRobe: '#8B1E3F',
  heshenTrim: '#E6C35C',
  farmer: '#9A7B4F',
  farmerPatch: '#6A5340',
  straw: '#C8A45A',
  soldier: '#1F3D4D',
  soldierArmor: '#6B5344',
  soldierTrim: '#8B2E2E',
  playerRobe: '#6E9B8B',
  playerTrim: '#F0E4C4',
  shoe: '#2A2018',
  hatRed: '#8B1A1A',
  hatBlack: '#16120E',
  wood: '#6B4A2A',
  rope: '#A08050'
};
