import {
  AbstractMesh,
  CascadedShadowGenerator,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3
} from '@babylonjs/core';
import { hexColor } from './materials';

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const dpr = window.devicePixelRatio || 1;
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: false,
    audioEngine: false,
    powerPreference: 'high-performance'
  });
  const cap = Math.min(dpr, 2);
  engine.setHardwareScalingLevel(1 / cap);
  return engine;
}

export function createGameScene(
  engine: Engine,
  opts: { clear: string; fog: string; fogStart: number; fogEnd: number }
): Scene {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromColor3(hexColor(opts.clear), 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = hexColor(opts.fog);
  scene.fogStart = opts.fogStart;
  scene.fogEnd = opts.fogEnd;
  scene.skipPointerMovePicking = true;
  scene.autoClear = true;
  scene.blockMaterialDirtyMechanism = false;
  scene.shadowsEnabled = true;

  const ipc = scene.imageProcessingConfiguration;
  ipc.toneMappingEnabled = true;
  ipc.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ipc.exposure = 1.0;
  ipc.contrast = 1.08;
  ipc.vignetteEnabled = false;

  // Cool daylight environment: blue sky bounce, not amber.
  const env = CubeTexture.CreateFromImages(makeEnvFaces(), scene);
  env.name = 'day-env';
  scene.environmentTexture = env;
  scene.environmentIntensity = 0.28;

  return scene;
}

function makeEnvFaces(): string[] {
  const faces: Array<[string, string]> = [
    ['#c5d6e8', '#7a9ab4'], // +x
    ['#6a849c', '#3d5060'], // -x shade
    ['#7eb4e0', '#4a8ac8'], // +y sky
    ['#4a524c', '#2e3430'], // -y ground
    ['#b0c8dc', '#6a8aa4'],
    ['#8aa8c0', '#506878']
  ];
  return faces.map(([top, bot]) => gradientDataUrl(top, bot));
}

function gradientDataUrl(top: string, bottom: string): string {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c.toDataURL('image/png');
}

export function addSunSkyLights(
  scene: Scene,
  opts: { sunDir: Vector3; sunColor: Color3; sunInt: number; hemiInt: number; ground: Color3 }
): { sun: DirectionalLight; hemi: HemisphericLight } {
  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.15), scene);
  hemi.intensity = opts.hemiInt;
  hemi.diffuse = new Color3(0.82, 0.90, 0.98);
  hemi.groundColor = opts.ground;
  hemi.specular = new Color3(0.16, 0.18, 0.2);

  const sun = new DirectionalLight('sun', opts.sunDir, scene);
  sun.intensity = opts.sunInt;
  sun.diffuse = opts.sunColor;
  sun.specular = new Color3(
    opts.sunColor.r * 0.5,
    opts.sunColor.g * 0.48,
    opts.sunColor.b * 0.45
  );
  sun.shadowMinZ = 0.5;
  sun.shadowMaxZ = 120;
  sun.autoUpdateExtends = true;
  return { sun, hemi };
}

export function addWarmPalaceLights(scene: Scene): {
  sun: DirectionalLight;
  hemi: HemisphericLight;
  shadows: CascadedShadowGenerator;
} {
  // Cooler clear daylight — not the old amber sun that washed the frame brown-yellow.
  const { sun, hemi } = addSunSkyLights(scene, {
    sunDir: new Vector3(-0.45, -1.05, 0.4),
    sunColor: new Color3(1, 0.97, 0.9),
    sunInt: 1.15,
    hemiInt: 0.52,
    ground: new Color3(0.28, 0.32, 0.3)
  });
  return { sun, hemi, shadows: makeShadows(scene, sun) };
}

export function makeShadows(scene: Scene, sun: DirectionalLight): CascadedShadowGenerator {
  const shadows = new CascadedShadowGenerator(1024, sun);
  shadows.numCascades = 2;
  shadows.lambda = 0.72;
  shadows.stabilizeCascades = true;
  shadows.autoCalcDepthBounds = true;
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.darkness = 0.38;
  shadows.bias = 0.006;
  shadows.normalBias = 0.02;
  shadows.shadowMaxZ = 90;
  void scene;
  return shadows;
}

export function finalizeShadows(scene: Scene, shadows: ShadowGenerator): void {
  const skip = /^(sky-dome|shadow|shadowblob|title-haze)/i;
  const skipCast = /paving|pave-|pond-water|floor|carpet|sea|ql-land|ql-farm|ql-sea|ql-beach|shadow|sky|title-haze/i;
  const forceCast = /wall|hall|gate|roof|column|lion|tree|plum|bamboo|rock|banner|pennant|throne|screen|pavilion|bridge|chest|lantern|cauldron|peony|balustrade|walkway|finial|bell|char:|sleeve|robe|head|cabin|keel|sail|mast|flagship|escort|player|meshy|tripo/i;
  for (const mesh of scene.meshes) {
    if (skip.test(mesh.name)) continue;
    mesh.receiveShadows = true;
    if (skipCast.test(mesh.name)) continue;
    let size = 0;
    try {
      size = mesh.getBoundingInfo().diagonalLength;
    } catch {
      size = 0;
    }
    const named = forceCast.test(mesh.name) || forceCast.test(mesh.parent?.name ?? '');
    if (named || size > 2.4) {
      shadows.addShadowCaster(mesh, false);
    }
  }
}

/**
 * Light touch-up only. Do not wash stone / plaster / roofs into one cream-sand
 * family — `applyPalacePalette` assigns 红墙 / 黃琉璃 / 汉白玉 / 青砖 per mesh.
 */
export function enrichImportedMaterials(scene: Scene): void {
  for (const mat of scene.materials) {
    if (
      mat.name === 'sky-mat' ||
      mat.name === 'paving-cobble' ||
      mat.name === 'paving-overlay' ||
      mat.name.startsWith('pave-') ||
      mat.name === 'lantern-paper-red' ||
      mat.name === 'title-haze-mat' ||
      mat.name.startsWith('meshy-') ||
      mat.name.startsWith('tripo-') ||
      mat.name.startsWith('bridge-') ||
      mat.name.startsWith('palette-')
    ) {
      continue;
    }
    if (mat.isFrozen) {
      try {
        mat.unfreeze();
      } catch {
        /* ignore */
      }
    }
    const name = mat.name.toLowerCase();
    if (mat instanceof PBRMaterial) {
      const a = mat.albedoColor;
      const isLeaf = name.includes('leaf');
      const isLacquer = name.includes('lacquer');
      const isGlaze = name.includes('glaze') || name.includes('gold');
      const isPlaster = name.includes('plaster');
      const isStone = name.includes('stone') || name.includes('paving') || name.includes('marble');
      if (isPlaster || isStone) {
        // Leave albedo; role-specific palette materials replace these on meshes.
        mat.roughness = Math.max(mat.roughness ?? 0.55, 0.7);
      } else if (isLacquer) {
        a.r = Math.min(1, a.r * 1.05);
        a.g = a.g * 0.82;
        a.b = a.b * 0.75;
        mat.roughness = Math.min(mat.roughness ?? 0.5, 0.42);
      } else if (isGlaze) {
        a.r = Math.min(1, Math.max(a.r, 0.72) * 1.04);
        a.g = Math.min(1, Math.max(a.g, 0.52));
        a.b = Math.min(a.b, 0.22);
        mat.roughness = Math.min(mat.roughness ?? 0.5, 0.38);
        mat.metallic = Math.max(mat.metallic ?? 0, 0.12);
      } else if (isLeaf) {
        a.r = Math.min(1, a.r * 0.7);
        a.g = Math.min(1, a.g * 1.15 + 0.05);
        a.b = a.b * 0.7;
        if (mat.albedoTexture) mat.albedoTexture.level = 0.8;
      }
      mat.environmentIntensity = 0.22;
      if (typeof mat.directIntensity === 'number') mat.directIntensity = 1.08;
    } else if (mat instanceof StandardMaterial) {
      if (/(-mat$|std:|sky-mat|ql-|farm-|boot-|palette-)/.test(name) || mat.name.startsWith('std:')) continue;
    }
  }
}

/**
 * Blue daylight sky with soft white clouds (procedural canvas, no paid skybox
 * and no official photographs). `top` / `horizon` should stay in the blue
 * family — amber horizons are ignored by using a blue base and only a slight tint.
 */
export function addSkyDome(scene: Scene, top: string, horizon: string, size = 260): void {
  const dome = MeshBuilder.CreateSphere('sky-dome', { diameter: size, segments: 24 }, scene);
  dome.infiniteDistance = true;
  const mat = new StandardMaterial('sky-mat', scene);
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.emissiveColor = Color3.White();
  mat.emissiveTexture = makeSkyCloudTexture(scene, top, horizon);
  mat.fogEnabled = false;
  dome.material = mat;
  dome.isPickable = false;
  dome.applyFog = false;
}

function makeSkyCloudTexture(scene: Scene, topHex: string, horizonHex: string): Texture {
  const existing = scene.getTextureByName('sky-cloud-tex');
  if (existing instanceof Texture) return existing;
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const zenith = mixHex(topHex, '#2F74C4', 0.55);
  const mid = '#5BA3E0';
  const horizon = mixHex(horizonHex, '#B7D4EE', 0.7);
  const under = '#8BB4D0';
  // Paint both poles as zenith so clouds show whichever way sphere V is wound.
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, zenith);
  grd.addColorStop(0.22, mid);
  grd.addColorStop(0.5, horizon);
  grd.addColorStop(0.78, mid);
  grd.addColorStop(1, zenith);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // Soft fill under the equator (hidden by ground, but keep it blue-grey not yellow).
  g.fillStyle = 'rgba(139, 180, 208, 0.15)';
  g.fillRect(0, h * 0.42, w, h * 0.16);

  let seed = 97;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const paintBand = (v0: number, v1: number) => {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const cx = rnd() * w;
      const cy = (v0 + rnd() * (v1 - v0)) * h;
      const rw = 70 + rnd() * 160;
      const rh = 22 + rnd() * 40;
      const puffs = 3 + Math.floor(rnd() * 4);
      for (let p = 0; p < puffs; p++) {
        const px = cx + (rnd() - 0.5) * rw * 1.3;
        const py = cy + (rnd() - 0.5) * rh;
        const radX = rw * (0.35 + rnd() * 0.5);
        const radY = rh * (0.5 + rnd() * 0.6);
        const grdC = g.createRadialGradient(px, py, 2, px, py, Math.max(radX, radY));
        const a = 0.55 + rnd() * 0.35;
        grdC.addColorStop(0, `rgba(255,255,255,${a})`);
        grdC.addColorStop(0.45, `rgba(248,250,252,${a * 0.7})`);
        grdC.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grdC;
        g.beginPath();
        g.ellipse(px, py, radX, radY, (rnd() - 0.5) * 0.6, 0, Math.PI * 2);
        g.fill();
      }
      // Slight grey underside so clouds read as volumes, not flat cutouts.
      const shade = g.createRadialGradient(cx, cy + rh * 0.45, 4, cx, cy + rh * 0.45, rw * 0.7);
      shade.addColorStop(0, 'rgba(200, 210, 220, 0.22)');
      shade.addColorStop(1, 'rgba(200, 210, 220, 0)');
      g.fillStyle = shade;
      g.beginPath();
      g.ellipse(cx, cy + rh * 0.35, rw * 0.7, rh * 0.45, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  paintBand(0.08, 0.38);
  paintBand(0.62, 0.92);
  const tex = new Texture(c.toDataURL('image/png'), scene, true, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.name = 'sky-cloud-tex';
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  return tex;
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexColor(a);
  const cb = hexColor(b);
  const m = Color3.Lerp(ca, cb, t);
  const r = Math.round(m.r * 255);
  const g = Math.round(m.g * 255);
  const bl = Math.round(m.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/** Unlit warm haze for the title beauty shot. Uses a textured backdrop so SwiftShader does not flatten a vertex-color dome to grey. */
export function addTitleHaze(scene: Scene): void {
  // SwiftShader flattens unlit sky meshes (domes, cylinders, textured backdrops) to grey.
  // Keep the accepted warm cream clearColor; soft haze is a CSS layer under body.title-open.
  void scene;
}


void AbstractMesh;
