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
  ipc.exposure = 0.9;
  ipc.contrast = 1.14;
  ipc.vignetteEnabled = false;

  // Dimmer, warmer env so imported PBR stone does not clip to white.
  const env = CubeTexture.CreateFromImages(makeEnvFaces(), scene);
  env.name = 'warm-env';
  scene.environmentTexture = env;
  scene.environmentIntensity = 0.22;

  return scene;
}

function makeEnvFaces(): string[] {
  const faces: Array<[string, string]> = [
    ['#e6c48a', '#9a6e3c'], // +x sun
    ['#6d7d96', '#3d4a5c'], // -x shade
    ['#9eb4cc', '#6f89a6'], // +y sky (not near-white)
    ['#5a4630', '#3a2c1c'], // -y ground
    ['#c9b07a', '#7a5a38'],
    ['#7a8aa0', '#4a5868']
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
  hemi.diffuse = new Color3(0.92, 0.88, 0.8);
  hemi.groundColor = opts.ground;
  hemi.specular = new Color3(0.18, 0.16, 0.12);

  const sun = new DirectionalLight('sun', opts.sunDir, scene);
  sun.intensity = opts.sunInt;
  sun.diffuse = opts.sunColor;
  sun.specular = new Color3(
    opts.sunColor.r * 0.45,
    opts.sunColor.g * 0.4,
    opts.sunColor.b * 0.3
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
  const { sun, hemi } = addSunSkyLights(scene, {
    sunDir: new Vector3(-0.45, -1.05, 0.4),
    sunColor: new Color3(1, 0.86, 0.66),
    sunInt: 1.12,
    hemiInt: 0.42,
    ground: new Color3(0.38, 0.34, 0.2)
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

/** Pull pale imported stone back from white; keep lacquer and tile strong. */
export function enrichImportedMaterials(scene: Scene): void {
  for (const mat of scene.materials) {
    if (mat.name === 'sky-mat' || mat.name === 'paving-cobble' || mat.name === 'paving-overlay' || mat.name.startsWith('pave-') || mat.name === 'lantern-paper-red' || mat.name === 'title-haze-mat' || mat.name.startsWith('meshy-') || mat.name.startsWith('tripo-')) continue;
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
      const luma = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
      const maxc = Math.max(a.r, a.g, a.b);
      const minc = Math.min(a.r, a.g, a.b);
      const sat = maxc > 1e-4 ? (maxc - minc) / maxc : 0;
      const isStone = name.includes('stone') || name.includes('paving') || name.includes('plaster');
      const isLeaf = name.includes('leaf');
      const isLacquer = name.includes('lacquer');
      const isGlaze = name.includes('glaze') || name.includes('gold');
      if (isLacquer || (a.r > a.g + 0.12 && a.r > a.b + 0.12 && !isStone)) {
        a.r = Math.min(1, a.r * 1.05);
        a.g = a.g * 0.82;
        a.b = a.b * 0.75;
        mat.roughness = Math.min(mat.roughness ?? 0.5, 0.42);
      } else if (isGlaze || (a.r > 0.55 && a.g > 0.4 && a.b < 0.4 && a.r + a.g > a.b * 3 && !isStone)) {
        a.r = Math.min(1, a.r * 1.02 + 0.02);
        a.g = Math.min(1, a.g * 0.95);
        a.b = a.b * 0.65;
        mat.roughness = Math.min(mat.roughness ?? 0.5, 0.38);
        mat.metallic = Math.max(mat.metallic ?? 0, 0.14);
      } else if (isLeaf) {
        a.r = Math.min(1, a.r * 0.7);
        a.g = Math.min(1, a.g * 1.15 + 0.05);
        a.b = a.b * 0.7;
        if (mat.albedoTexture) mat.albedoTexture.level = 0.8;
      } else if (isStone || (luma > 0.55 && sat < 0.28)) {
        // Pale stone / plaster / washed paving: warm cream-sand, never grey-white.
        a.r = Math.min(0.84, a.r * 0.52 + 0.28);
        a.g = Math.min(0.72, a.g * 0.46 + 0.2);
        a.b = Math.min(0.5, a.b * 0.34 + 0.08);
        mat.roughness = Math.max(mat.roughness ?? 0.55, 0.78);
        if (mat.albedoTexture) mat.albedoTexture.level = 0.48;
      } else if (luma < 0.35) {
        a.r = Math.min(1, a.r * 1.06 + 0.02);
        a.g = a.g * 1.0;
        mat.roughness = Math.max(mat.roughness ?? 0.55, 0.5);
      }
      mat.environmentIntensity = 0.18;
      if (typeof mat.directIntensity === 'number') mat.directIntensity = 1.12;
    } else if (mat instanceof StandardMaterial) {
      // Procedural grounds/characters use StandardMaterial with vertex colours — leave them alone.
      if (/(-mat$|std:|sky-mat|ql-|farm-|boot-)/.test(name) || mat.name.startsWith('std:')) continue;
      const a = mat.diffuseColor;
      const luma = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
      const maxc = Math.max(a.r, a.g, a.b);
      const minc = Math.min(a.r, a.g, a.b);
      const sat = maxc > 1e-4 ? (maxc - minc) / maxc : 0;
      if (luma > 0.55 && sat < 0.28) {
        mat.diffuseColor = new Color3(
          Math.min(0.84, a.r * 0.52 + 0.28),
          Math.min(0.72, a.g * 0.46 + 0.2),
          Math.min(0.5, a.b * 0.34 + 0.08)
        );
        mat.specularColor = new Color3(0.12, 0.11, 0.09);
        if (mat.diffuseTexture) mat.diffuseTexture.level = 0.5;
      }
    }
  }
}

export function addSkyDome(scene: Scene, top: string, horizon: string, size = 260): void {
  const dome = MeshBuilder.CreateSphere('sky-dome', { diameter: size, segments: 16 }, scene);
  dome.infiniteDistance = true;
  const mat = new StandardMaterial('sky-mat', scene);
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.emissiveTexture = null;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  const positions = dome.getVerticesData('position');
  if (positions) {
    const colors: number[] = [];
    const t = hexColor(top);
    const h = hexColor(horizon);
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1] / (size * 0.5);
      const k = Math.min(1, Math.max(0, y * 0.5 + 0.5));
      const c = Color3.Lerp(h, t, k);
      colors.push(c.r, c.g, c.b, 1);
    }
    dome.setVerticesData('color', colors);
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    dome.useVertexColors = true;
  } else {
    mat.emissiveColor = hexColor(horizon);
  }
  dome.material = mat;
  dome.isPickable = false;
  dome.applyFog = false;
}

/** Unlit warm haze for the title beauty shot. Uses a textured backdrop so SwiftShader does not flatten a vertex-color dome to grey. */
export function addTitleHaze(scene: Scene): void {
  // SwiftShader flattens unlit sky meshes (domes, cylinders, textured backdrops) to grey.
  // Keep the accepted warm cream clearColor; soft haze is a CSS layer under body.title-open.
  void scene;
}


void AbstractMesh;
