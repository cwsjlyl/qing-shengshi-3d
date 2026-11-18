#!/usr/bin/env node
/**
 * Decimate Meshy high-poly grey meshes, recompute smooth normals, and
 * assign stylised PBR sub-materials from height / up-facing normals /
 * radius / curvature. Works only on copies — never writes the originals.
 *
 * Pipeline: weld the high-poly copy → classify and split by material →
 * simplify each part to a face budget (so detailed roofs cannot starve
 * smooth walls) → recompute normals → rebase the origin.
 *
 * Usage: node scripts/optimize-meshy.mjs [--only=pavilion,imperial-boat]
 */
import { mkdir, copyFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, normals, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = '/tmp/qing-meshy/work';
const OUT_DIR = join(ROOT, 'public/assets/models');
const REPORT_DIR = '/tmp/qing-meshy/optimized';

const PAL = {
  paper: [0.72, 0.14, 0.10, 1],
  gold: [0.83, 0.62, 0.18, 1],
  goldBright: [0.92, 0.75, 0.28, 1],
  lacquer: [0.55, 0.08, 0.07, 1],
  wood: [0.42, 0.26, 0.12, 1],
  woodDark: [0.32, 0.18, 0.08, 1],
  tile: [0.78, 0.5, 0.14, 1],
  tileDark: [0.28, 0.16, 0.12, 1],
  stone: [0.55, 0.5, 0.42, 1],
  stoneDark: [0.42, 0.38, 0.32, 1],
  stoneWarm: [0.74, 0.68, 0.56, 1],
  granite: [0.82, 0.75, 0.62, 1],
  mortar: [0.70, 0.64, 0.54, 1],
  celadon: [0.50, 0.68, 0.54, 1],
  petal: [0.84, 0.32, 0.34, 1],
  leaf: [0.26, 0.48, 0.18, 1],
  soil: [0.30, 0.20, 0.12, 1]
};

const JOBS = [
  {
    id: 'lantern',
    src: 'lantern.glb',
    out: 'meshy-lantern.glb',
    target: 5500,
    minFaces: 3000,
    maxFaces: 8000,
    origin: 'hook',
    classify: classifyLantern,
    budget: { paper: 0.46, gold: 0.54 }
  },
  {
    id: 'moon-gate',
    src: 'moon-gate.glb',
    out: 'meshy-moon-gate.glb',
    target: 12000,
    minFaces: 8000,
    maxFaces: 15000,
    origin: 'ground',
    classify: classifyMoonGate,
    budget: { lacquer: 0.48, tile: 0.28, stone: 0.18, gold: 0.06 }
  },
  {
    id: 'pavilion',
    src: 'pavilion.glb',
    out: 'meshy-pavilion.glb',
    target: 19500,
    minFaces: 12000,
    maxFaces: 24000,
    origin: 'ground',
    classify: classifyPavilion,
    budget: { tile: 0.66, lacquer: 0.14, wood: 0.09, stone: 0.11 },
    lockByKind: { tile: 0.0, default: 0.0 },
    errorCap: 0.05,
    shellClean: ['tile'],
    remeshShell: { tile: 96 }
  },
  {
    id: 'imperial-boat',
    src: 'imperial-boat.glb',
    out: 'meshy-imperial-boat.glb',
    target: 24000,
    minFaces: 15000,
    maxFaces: 25000,
    origin: 'keel',
    classify: classifyBoat,
    budget: { lacquer: 0.26, woodDark: 0.18, tileDark: 0.14, wood: 0.12, gold: 0.3 },
    lockByKind: { gold: 0.08, default: 0.0 },
    lockEnds: true,
    errorCap: 0.045
  },
  {
    id: 'garden-peony',
    src: 'garden-peony.glb',
    out: 'meshy-garden-peony.glb',
    target: 6500,
    minFaces: 3000,
    maxFaces: 8000,
    origin: 'ground',
    classify: classifyPeony,
    budget: { celadon: 0.26, gold: 0.10, soil: 0.08, leaf: 0.24, petal: 0.32 },
    lockByKind: { gold: 0.02, default: 0.0 },
    errorCap: 0.05,
    preserveFolds: false
  },
  {
    id: 'stone-drum-stool',
    src: 'stone-drum-stool.glb',
    out: 'meshy-stone-drum-stool.glb',
    target: 6000,
    minFaces: 3000,
    maxFaces: 8000,
    origin: 'ground',
    classify: classifyStool,
    budget: { stoneWarm: 0.74, gold: 0.26 },
    lockByKind: { gold: 0.08, default: 0.0 },
    errorCap: 0.04
  },
  {
    id: 'court-flagstones-v2',
    src: 'court-flagstones-v2.glb',
    out: 'meshy-court-flagstones.glb',
    target: 3600,
    minFaces: 1500,
    maxFaces: 4000,
    origin: 'ground',
    classify: classifyFlagstones,
    budget: { granite: 0.84, mortar: 0.16 },
    lockByKind: { granite: 0.08, default: 0.0 },
    errorCap: 0.022,
    preserveFoldsKinds: ['granite']
  }
];

function countFaces(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const ind = prim.getIndices();
      n += ind ? Math.floor(ind.getCount() / 3) : Math.floor((prim.getAttribute('POSITION')?.getCount() ?? 0) / 3);
    }
  }
  return n;
}

function primFaceCount(prim) {
  const ind = prim.getIndices();
  return ind ? Math.floor(ind.getCount() / 3) : Math.floor((prim.getAttribute('POSITION')?.getCount() ?? 0) / 3);
}

function boundsOf(doc) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], arr[i + k]);
          max[k] = Math.max(max[k], arr[i + k]);
        }
      }
    }
  }
  return { min, max };
}

function translatePositions(doc, dx, dy, dz) {
  const seen = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos || seen.has(pos)) continue;
      seen.add(pos);
      const arr = pos.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += dx;
        arr[i + 1] += dy;
        arr[i + 2] += dz;
      }
      pos.setArray(arr);
    }
  }
}

function faceInfo(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax,
    uy = by - ay,
    uz = bz - az;
  const vx = cx - ax,
    vy = cy - ay,
    vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const cx0 = (ax + bx + cx) / 3;
  const cy0 = (ay + by + cy) / 3;
  const cz0 = (az + bz + cz) / 3;
  return { nx, ny, nz, cx: cx0, cy: cy0, cz: cz0, area: len * 0.5 };
}

function classifyLantern(f, t, r, rMax) {
  // Hook at the very top; cap just below; paper body in the middle; tassel at the bottom.
  if (t > 0.86) return 'gold';
  if (t > 0.68 && t <= 0.86) return 'gold';
  if (t < 0.22) return 'gold';
  if (t < 0.34) return 'gold';
  if (t >= 0.34 && t <= 0.68) {
    if (r > rMax * 0.88) return 'gold';
    if (Math.abs(f.ny) > 0.75 && t > 0.62) return 'gold';
    return 'paper';
  }
  return 'paper';
}

function classifyMoonGate(f, t, r, rMax) {
  if (t < 0.18) return 'stone';
  if (t < 0.26 && f.ny > 0.55) return 'stone';
  if (t > 0.88 && Math.abs(f.ny) < 0.3) return 'gold';
  if (t > 0.82) return 'tile';
  if (t > 0.76 && (f.ny > 0.15 || f.ny < -0.12)) return 'tile';
  return 'lacquer';
}

function classifyPavilion(f, t, r, rMax) {
  if (t < 0.2) return 'stone';
  if (t < 0.28 && f.ny > 0.55) return 'stone';
  // Keep the whole two-tier roof and its upturned eaves as one tile
  // surface. Splitting gold onto the eave edge was leaving shattered flaps.
  if (t > 0.46 && f.ny > 0.2) return 'tile';
  if (t > 0.48 && f.ny < -0.12) return 'tile';
  if (t > 0.7) return 'tile';
  if (t > 0.26 && t < 0.48) {
    if (Math.abs(f.ny) < 0.25 && r > rMax * 0.72) return 'wood';
    if (Math.abs(f.ny) < 0.45) return 'lacquer';
  }
  if (t > 0.2 && t < 0.52 && Math.abs(f.ny) < 0.45) return 'lacquer';
  return 'wood';
}

function classifyPeony(f, t, r, rMax) {
  // rMax in splitPrimitive is half the xz bbox diagonal, so a circular
  // equator only reaches rn ≈ 0.71. Thresholds are calibrated to that.
  const rn = r / Math.max(1e-5, rMax);
  if (t > 0.20 && t < 0.30 && rn > 0.655) return 'gold';
  if (t < 0.38) return 'celadon';
  if (t < 0.52) {
    if (rn > 0.65) return 'gold';
    if (rn < 0.58 && f.ny > 0.3) return 'soil';
    if (rn > 0.58) return 'celadon';
    return 'soil';
  }
  if (t < 0.66) {
    if (rn < 0.42 && f.ny > 0.2) return 'soil';
    if (rn < 0.32) return 'soil';
    return 'leaf';
  }
  if (t < 0.72 && rn > 0.42) return 'leaf';
  return 'petal';
}

function classifyStool(f, t, r, rMax) {
  const rn = r / Math.max(1e-5, rMax);
  // Side bosses sit outside the cylinder (r ≳ 0.88 → rn ≳ 0.68).
  if (t > 0.42 && t < 0.68 && rn > 0.68) return 'gold';
  // Centre coin and the drum-nail ring, not the lid field.
  if (t > 0.92) {
    if (rn < 0.17) return 'gold';
    if (rn > 0.30 && rn < 0.54) return 'gold';
  }
  return 'stoneWarm';
}

function classifyFlagstones(f, t, r, rMax) {
  // Thin grout sheet and undersides sit in the low height band; stone
  // tops are a clearly separated high band (t > 0.7). Keep sides as granite
  // so slab edges stay sharp after the split.
  if (t < 0.45 && Math.abs(f.ny) >= 0.5) return 'mortar';
  return 'granite';
}

function classifyBoat(f, t, r, rMax, xmin, xmax) {
  const along = (f.cx - xmin) / Math.max(1e-5, xmax - xmin);
  const atBow = along < 0.12 || along > 0.88;
  if (t > 0.52 && f.ny > 0.32) return 'tileDark';
  if (t > 0.55 && f.ny < -0.15) return 'tileDark';
  if (t > 0.72) return atBow ? 'gold' : 'tileDark';
  if (atBow && t > 0.28 && t < 0.75 && Math.abs(f.ny) < 0.7) return 'gold';
  if (t > 0.58 && Math.abs(f.ny) < 0.45 && r > rMax * 0.55) return 'gold';
  if (t < 0.34 && f.ny < 0.45) return 'lacquer';
  if (t < 0.22) return 'lacquer';
  if (t > 0.28 && t < 0.48 && f.ny > 0.55) return 'wood';
  if (t > 0.3 && t < 0.62) return 'woodDark';
  return 'wood';
}

function makeMaterial(doc, kind) {
  const mat = doc.createMaterial(`meshy-${kind}`);
  const color = PAL[kind] ?? PAL.wood;
  mat.setBaseColorFactor(color);
  mat.setMetallicFactor(kind === 'gold' || kind === 'goldBright' ? 0.22 : kind === 'celadon' ? 0.04 : 0);
  mat.setRoughnessFactor(
    kind === 'gold' || kind === 'goldBright' ? 0.38
      : kind === 'paper' ? 0.55
      : kind === 'lacquer' ? 0.42
      : kind === 'celadon' ? 0.32
      : kind === 'petal' ? 0.48
      : kind === 'leaf' ? 0.62
      : kind === 'soil' ? 0.9
      : kind === 'stoneWarm' ? 0.7
      : kind === 'granite' ? 0.78
      : kind === 'mortar' ? 0.9
      : kind === 'tile' || kind === 'tileDark' ? 0.62
      : 0.78
  );
  if (kind === 'paper') {
    mat.setEmissiveFactor([0.45, 0.08, 0.04]);
  } else if (kind === 'gold' || kind === 'goldBright') {
    mat.setEmissiveFactor([0.1, 0.07, 0.02]);
  } else if (kind === 'tile') {
    mat.setEmissiveFactor([0.05, 0.025, 0.008]);
  } else if (kind === 'celadon') {
    mat.setEmissiveFactor([0.02, 0.035, 0.02]);
  } else if (kind === 'petal') {
    mat.setEmissiveFactor([0.06, 0.015, 0.015]);
  }
  mat.setDoubleSided(kind === 'paper' || kind === 'leaf' || kind === 'petal');
  return mat;
}

function implicitIndices(vertCount) {
  const n = vertCount;
  const out = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}

function splitPrimitive(doc, mesh, prim, classify) {
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const idx = prim.getIndices();
  if (!pos) return [];
  const p = pos.getArray();
  const nrmArr = nrm ? nrm.getArray() : null;
  const ind = idx ? idx.getArray() : implicitIndices(pos.getCount());
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();

  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  const ySpan = Math.max(1e-5, max[1] - min[1]);
  const rMax = Math.max(1e-5, Math.hypot(max[0] - min[0], max[2] - min[2]) * 0.5);
  const cx0 = (min[0] + max[0]) / 2;
  const cz0 = (min[2] + max[2]) / 2;

  const buckets = new Map();
  const nFaces = Math.floor(ind.length / 3);
  for (let f = 0; f < nFaces; f++) {
    const ia = ind[f * 3] * 3;
    const ib = ind[f * 3 + 1] * 3;
    const ic = ind[f * 3 + 2] * 3;
    const info = faceInfo(p[ia], p[ia + 1], p[ia + 2], p[ib], p[ib + 1], p[ib + 2], p[ic], p[ic + 1], p[ic + 2]);
    const t = (info.cy - min[1]) / ySpan;
    const r = Math.hypot(info.cx - cx0, info.cz - cz0);
    const label = classify(info, t, r, rMax, min[0], max[0], min, max);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(f);
  }

  const matCache = new Map();
  const newPrims = [];
  for (const [label, faces] of buckets) {
    if (!faces.length) continue;
    const vmap = new Map();
    const positions = [];
    const normalsArr = [];
    const indices = [];
    const addV = (vi) => {
      if (vmap.has(vi)) return vmap.get(vi);
      const o = vi * 3;
      const id = positions.length / 3;
      positions.push(p[o], p[o + 1], p[o + 2]);
      if (nrmArr) normalsArr.push(nrmArr[o], nrmArr[o + 1], nrmArr[o + 2]);
      vmap.set(vi, id);
      return id;
    };
    for (const f of faces) {
      indices.push(addV(ind[f * 3]), addV(ind[f * 3 + 1]), addV(ind[f * 3 + 2]));
    }
    const newPos = doc
      .createAccessor(`${label}-pos`)
      .setType('VEC3')
      .setArray(new Float32Array(positions))
      .setBuffer(buffer);
    const newInd = doc
      .createAccessor(`${label}-idx`)
      .setType('SCALAR')
      .setArray(indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices))
      .setBuffer(buffer);
    const newPrim = doc.createPrimitive().setAttribute('POSITION', newPos).setIndices(newInd);
    if (nrmArr && normalsArr.length) {
      newPrim.setAttribute(
        'NORMAL',
        doc.createAccessor(`${label}-nrm`).setType('VEC3').setArray(new Float32Array(normalsArr)).setBuffer(buffer)
      );
    }
    if (!matCache.has(label)) matCache.set(label, makeMaterial(doc, label));
    newPrim.setMaterial(matCache.get(label));
    newPrim.setName(label);
    newPrims.push(newPrim);
    console.log(`    split ${label}: ${faces.length} faces, ${positions.length / 3} verts`);
  }

  mesh.removePrimitive(prim);
  for (const np of newPrims) mesh.addPrimitive(np);
  return newPrims;
}


function removeInteriorFaces(prim, maxDist = 0.07, eps = 0.0015) {
  const posAcc = prim.getAttribute('POSITION');
  const idxAcc = prim.getIndices();
  if (!posAcc || !idxAcc) return 0;
  const p = posAcc.getArray();
  const ind = Array.from(idxAcc.getArray());
  const nFaces = Math.floor(ind.length / 3);
  const cents = new Float32Array(nFaces * 3);
  const nrms = new Float32Array(nFaces * 3);
  const tris = new Int32Array(nFaces * 3);
  for (let f = 0; f < nFaces; f++) {
    const ia = ind[f * 3],
      ib = ind[f * 3 + 1],
      ic = ind[f * 3 + 2];
    tris[f * 3] = ia;
    tris[f * 3 + 1] = ib;
    tris[f * 3 + 2] = ic;
    const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
    const bx = p[ib * 3], by = p[ib * 3 + 1], bz = p[ib * 3 + 2];
    const cx = p[ic * 3], cy = p[ic * 3 + 1], cz = p[ic * 3 + 2];
    cents[f * 3] = (ax + bx + cx) / 3;
    cents[f * 3 + 1] = (ay + by + cy) / 3;
    cents[f * 3 + 2] = (az + bz + cz) / 3;
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz) || 1;
    nrms[f * 3] = nx / len;
    nrms[f * 3 + 1] = ny / len;
    nrms[f * 3 + 2] = nz / len;
  }
  // Uniform grid on all triangle AABBs, cell size ~ maxDist.
  const cell = Math.max(0.02, maxDist);
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const put = (x, y, z, f) => {
    const k = key(x, y, z);
    let arr = grid.get(k);
    if (!arr) {
      arr = [];
      grid.set(k, arr);
    }
    arr.push(f);
  };
  for (let f = 0; f < nFaces; f++) {
    const ia = tris[f * 3], ib = tris[f * 3 + 1], ic = tris[f * 3 + 2];
    const minx = Math.min(p[ia * 3], p[ib * 3], p[ic * 3]);
    const miny = Math.min(p[ia * 3 + 1], p[ib * 3 + 1], p[ic * 3 + 1]);
    const minz = Math.min(p[ia * 3 + 2], p[ib * 3 + 2], p[ic * 3 + 2]);
    const maxx = Math.max(p[ia * 3], p[ib * 3], p[ic * 3]);
    const maxy = Math.max(p[ia * 3 + 1], p[ib * 3 + 1], p[ic * 3 + 1]);
    const maxz = Math.max(p[ia * 3 + 2], p[ib * 3 + 2], p[ic * 3 + 2]);
    const x0 = Math.floor(minx / cell), x1 = Math.floor(maxx / cell);
    const y0 = Math.floor(miny / cell), y1 = Math.floor(maxy / cell);
    const z0 = Math.floor(minz / cell), z1 = Math.floor(maxz / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, f);
  }

  function rayHit(ox, oy, oz, dx, dy, dz, skip, tmax) {
    const x0 = Math.floor(ox / cell), y0 = Math.floor(oy / cell), z0 = Math.floor(oz / cell);
    const x1 = Math.floor((ox + dx * tmax) / cell);
    const y1 = Math.floor((oy + dy * tmax) / cell);
    const z1 = Math.floor((oz + dz * tmax) / cell);
    const seen = new Set();
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    for (let x = x0; x !== x1 + sx; x += sx) {
      for (let y = y0; y !== y1 + sy; y += sy) {
        for (let z = z0; z !== z1 + sz; z += sz) {
          const arr = grid.get(key(x, y, z));
          if (!arr) continue;
          for (const f of arr) {
            if (f === skip || seen.has(f)) continue;
            seen.add(f);
            const ia = tris[f * 3], ib = tris[f * 3 + 1], ic = tris[f * 3 + 2];
            if (moller(ox, oy, oz, dx, dy, dz, ia, ib, ic, tmax)) return true;
          }
        }
      }
    }
    return false;
  }

  function moller(ox, oy, oz, dx, dy, dz, ia, ib, ic, tmax) {
    const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
    const bx = p[ib * 3], by = p[ib * 3 + 1], bz = p[ib * 3 + 2];
    const cx = p[ic * 3], cy = p[ic * 3 + 1], cz = p[ic * 3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det;
    const sx = ox - ax, sy = oy - ay, sz = oz - az;
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) return false;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return false;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return t > 1e-6 && t <= tmax;
  }

  const keep = [];
  let removed = 0;
  for (let f = 0; f < nFaces; f++) {
    const nx = nrms[f * 3], ny = nrms[f * 3 + 1], nz = nrms[f * 3 + 2];
    const cx = cents[f * 3] + nx * eps;
    const cy = cents[f * 3 + 1] + ny * eps;
    const cz = cents[f * 3 + 2] + nz * eps;
    const hitOut = rayHit(cx, cy, cz, nx, ny, nz, f, maxDist);
    const hitIn = rayHit(cx, cy, cz, -nx, -ny, -nz, f, maxDist);
    if (hitOut && hitIn) {
      removed++;
      continue;
    }
    keep.push(f);
  }
  if (!removed) return 0;
  const newIdx = [];
  for (const f of keep) {
    newIdx.push(ind[f * 3], ind[f * 3 + 1], ind[f * 3 + 2]);
  }
  idxAcc.setArray(newIdx.length > 65535 ? new Uint32Array(newIdx) : new Uint16Array(newIdx));
  compactPrimitive(prim);
  return removed;
}

function compactPrimitive(prim) {
  const posAcc = prim.getAttribute('POSITION');
  const nrmAcc = prim.getAttribute('NORMAL');
  const idxAcc = prim.getIndices();
  if (!posAcc || !idxAcc) return;
  const pos = posAcc.getArray();
  const nrm = nrmAcc ? nrmAcc.getArray() : null;
  const ind = Array.from(idxAcc.getArray());
  const used = new Map();
  const newPos = [];
  const newNrm = [];
  const newInd = [];
  for (const vi of ind) {
    if (!used.has(vi)) {
      used.set(vi, newPos.length / 3);
      newPos.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
      if (nrm) newNrm.push(nrm[vi * 3], nrm[vi * 3 + 1], nrm[vi * 3 + 2]);
    }
    newInd.push(used.get(vi));
  }
  posAcc.setArray(new Float32Array(newPos));
  if (nrmAcc && newNrm.length) nrmAcc.setArray(new Float32Array(newNrm));
  idxAcc.setArray(newInd.length > 65535 ? new Uint32Array(newInd) : new Uint16Array(newInd));
}

function curvatureLock(positions, indices, fraction, alsoEnds = false) {
  const vcount = positions.length / 3;
  const acc = new Float32Array(vcount * 3);
  const counts = new Uint16Array(vcount);
  const nFaces = Math.floor(indices.length / 3);
  let minX = Infinity,
    maxX = -Infinity;
  for (let i = 0; i < vcount; i++) {
    const x = positions[i * 3];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  for (let f = 0; f < nFaces; f++) {
    const ia = indices[f * 3];
    const ib = indices[f * 3 + 1];
    const ic = indices[f * 3 + 2];
    const ax = positions[ia * 3],
      ay = positions[ia * 3 + 1],
      az = positions[ia * 3 + 2];
    const bx = positions[ib * 3],
      by = positions[ib * 3 + 1],
      bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3],
      cy = positions[ic * 3 + 1],
      cz = positions[ic * 3 + 2];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const i of [ia, ib, ic]) {
      acc[i * 3] += nx;
      acc[i * 3 + 1] += ny;
      acc[i * 3 + 2] += nz;
      counts[i]++;
    }
  }
  const scores = new Float32Array(vcount);
  for (let i = 0; i < vcount; i++) {
    const c = counts[i] || 1;
    const len = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) / c;
    scores[i] = 1 - Math.min(1, len);
    if (alsoEnds) {
      const along = (positions[i * 3] - minX) / Math.max(1e-5, maxX - minX);
      if (along < 0.14 || along > 0.86) scores[i] += 0.35;
    }
  }
  const order = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]);
  const lock = new Uint8Array(vcount);
  const nLock = Math.min(vcount, Math.max(0, Math.floor(vcount * fraction)));
  for (let i = 0; i < nLock; i++) lock[order[i]] = 1;
  return lock;
}

function simplifyPrimitive(prim, targetFaces, opts = {}) {
  const posAcc = prim.getAttribute('POSITION');
  const idxAcc = prim.getIndices();
  if (!posAcc || !idxAcc) return primFaceCount(prim);
  const srcFaces = primFaceCount(prim);
  if (srcFaces <= targetFaces) return srcFaces;
  const positions = new Float32Array(posAcc.getArray());
  const srcIdx = new Uint32Array(idxAcc.getArray());
  const fraction = opts.lockFraction ?? 0;
  const lock = fraction > 0 ? curvatureLock(positions, srcIdx, fraction, !!opts.lockEnds) : null;
  // Do not use LockBorder after a material split: the new cut edges would
  // freeze most of the mesh and leave classroom-unsafe face counts.
  const flags = opts.preserveFolds ? ['PreserveFolds', 'Regularize'] : ['Regularize'];
  const errorCap = opts.errorCap ?? 0.04;
  let error = 0.002;
  let best = null;
  let bestFaces = srcFaces;
  for (let attempt = 0; attempt < 8; attempt++) {
    const [dst] = lock
      ? MeshoptSimplifier.simplifyWithAttributes(
          srcIdx,
          positions,
          3,
          new Float32Array(0),
          0,
          [],
          lock,
          Math.max(3, targetFaces * 3),
          error,
          flags
        )
      : MeshoptSimplifier.simplify(srcIdx, positions, 3, Math.max(3, targetFaces * 3), error, flags);
    const faces = Math.floor(dst.length / 3);
    const inBand = faces >= Math.floor(targetFaces * 0.88) && faces <= Math.ceil(targetFaces * 1.15);
    const over = faces > targetFaces * 1.15;
    const under = faces < targetFaces * 0.88;
    const closer = Math.abs(faces - targetFaces) < Math.abs(bestFaces - targetFaces);
    // Never prefer a result that falls far under the budget if we already have one in/above band.
    const better =
      best === null ||
      inBand && closer ||
      !inBand && closer && !(under && bestFaces >= targetFaces * 0.88);
    if (better) {
      best = dst;
      bestFaces = faces;
    }
    if (inBand) break;
    if (over) error = Math.min(errorCap, error * (faces > targetFaces * 2 ? 3.2 : 2.3));
    else error = Math.max(0.0002, error * 0.4);
  }
  if (best && bestFaces < srcFaces) {
    idxAcc.setArray(best.length > 65535 ? new Uint32Array(best) : new Uint16Array(best));
    compactPrimitive(prim);
  }
  return primFaceCount(prim);
}

function materialKind(prim) {
  const name = prim.getMaterial()?.getName() || prim.getName() || '';
  return name.replace(/^meshy-/, '');
}

async function processJob(job) {
  const src = join(SRC_DIR, job.src);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  await MeshoptSimplifier.ready;
  const doc = await io.read(src);
  const before = countFaces(doc);
  console.log(`\n== ${job.id} == ${before} faces → target ${job.target}`);

  // Do not run normals() before the split: it unindexes the mesh into a
  // triangle soup, and MeshoptSimplifier cannot collapse unshared vertices.
  await doc.transform(dedup(), weld({ tolerance: 0.00005 }));

  for (const mesh of doc.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives().slice();
    for (const prim of prims) splitPrimitive(doc, mesh, prim, job.classify);
  }

  await doc.transform(weld({ tolerance: 0.00008 }));

  if (job.shellClean && job.shellClean.length) {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const kind = materialKind(prim);
        if (!job.shellClean.includes(kind)) continue;
        const before = primFaceCount(prim);
        const removed = removeInteriorFaces(prim, 0.065, 0.0012);
        console.log(`    shell-clean ${kind}: removed ${removed} interior faces (${before} → ${primFaceCount(prim)})`);
      }
    }
  }


  if (job.remeshShell) {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const kind = materialKind(prim);
        const res = job.remeshShell[kind];
        if (!res) continue;
        const posAcc = prim.getAttribute('POSITION');
        const idxAcc = prim.getIndices();
        if (!posAcc || !idxAcc) continue;
        const srcFaces = primFaceCount(prim);
        const out = MeshoptSimplifier.remesh(
          new Uint32Array(idxAcc.getArray()),
          new Float32Array(posAcc.getArray()),
          3,
          res,
          ['Shell']
        );
        const nFaces = out.length / 9;
        const vmap = new Map();
        const positions = [];
        const indices = [];
        const key = (x, y, z) => `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
        const add = (o) => {
          const k = key(out[o], out[o + 1], out[o + 2]);
          if (vmap.has(k)) return vmap.get(k);
          const id = positions.length / 3;
          positions.push(out[o], out[o + 1], out[o + 2]);
          vmap.set(k, id);
          return id;
        };
        for (let f = 0; f < nFaces; f++) indices.push(add(f * 9), add(f * 9 + 3), add(f * 9 + 6));
        posAcc.setArray(new Float32Array(positions));
        const nrm = prim.getAttribute('NORMAL');
        if (nrm) prim.setAttribute('NORMAL', null);
        idxAcc.setArray(indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices));
        console.log(`    remesh-shell ${kind}: ${srcFaces} → ${nFaces} raw / ${indices.length / 3} welded (res ${res})`);
      }
    }
  }

  // Allocate a face budget per material so dense roofs cannot starve walls.
  const parts = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) parts.push(prim);
  }
  const weights = job.budget || {};
  const known = parts.filter((p) => (weights[materialKind(p)] ?? 0) > 0);
  const unknown = parts.filter((p) => !weights[materialKind(p)]);
  const knownWeight = known.reduce((s, p) => s + (weights[materialKind(p)] || 0), 0);
  const leftover = Math.max(0, 1 - knownWeight);
  const unknownShare = unknown.length ? leftover / unknown.length : 0;

  let afterSimplify = 0;
  for (const prim of parts) {
    const kind = materialKind(prim);
    const w = weights[kind] ?? unknownShare ?? 0.05;
    const srcFaces = primFaceCount(prim);
    const target = Math.max(24, Math.min(srcFaces, Math.round(job.target * w)));
    const lockMap = job.lockByKind || {};
    const lockFraction = lockMap[kind] ?? lockMap.default ?? 0;
    const faces = simplifyPrimitive(prim, target, {
      lockFraction,
      lockEnds: !!job.lockEnds && kind === 'gold',
      errorCap: job.errorCap,
      preserveFolds: job.preserveFoldsKinds
        ? job.preserveFoldsKinds.includes(kind)
        : job.preserveFolds !== false && kind === 'gold'
    });
    afterSimplify += faces;
    console.log(`    simplify ${kind}: ${srcFaces} → ${faces} (budget ${target}, lock ${lockFraction})`);
  }

  if (afterSimplify < job.minFaces || afterSimplify > job.maxFaces) {
    console.warn(`  NOTE: ${afterSimplify} faces vs band ${job.minFaces}–${job.maxFaces}; leaving as-is if still classroom-safe.`);
  }

  await doc.transform(weld({ tolerance: 0.00008 }), normals({ overwrite: true }), prune());

  const b = boundsOf(doc);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  let dy = 0;
  if (job.origin === 'hook') dy = -b.max[1];
  else if (job.origin === 'ground' || job.origin === 'keel') dy = -b.min[1];
  translatePositions(doc, -cx, dy, -cz);
  const after = boundsOf(doc);
  const facesFinal = countFaces(doc);
  console.log(
    `  origin ${job.origin}: y ${after.min[1].toFixed(3)}..${after.max[1].toFixed(3)}  xz ${after.min[0].toFixed(3)}..${after.max[0].toFixed(3)}, ${after.min[2].toFixed(3)}..${after.max[2].toFixed(3)}`
  );
  console.log(`  final faces ${facesFinal}`);

  const outGame = join(OUT_DIR, job.out);
  const outReport = join(REPORT_DIR, job.out);
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });
  await io.write(outGame, doc);
  await copyFile(outGame, outReport);
  const bytes = (await stat(outGame)).size;
  return { id: job.id, file: job.out, facesBefore: before, faces: facesFinal, bytes, bounds: after };
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const jobs = only ? JOBS.filter((j) => only.includes(j.id)) : JOBS;
if (only && jobs.length !== only.length) {
  const missing = only.filter((id) => !JOBS.some((j) => j.id === id));
  throw new Error(`Unknown --only id(s): ${missing.join(', ')}`);
}

const results = [];
for (const job of jobs) {
  results.push(await processJob(job));
}
console.log('\n==== SUMMARY ====');
for (const r of results) {
  console.log(
    `${r.id}: ${r.faces} faces, ${(r.bytes / 1024).toFixed(1)} KB  (from ${r.facesBefore})  y=${r.bounds.min[1].toFixed(2)}..${r.bounds.max[1].toFixed(2)}`
  );
}
