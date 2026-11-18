/**
 * Unit checks for stair height, camera-relative movement, and a dense
 * walk-audit of all three stages (player radius, not just a few points).
 * Run: node --experimental-strip-types scripts/check-walk.ts
 */
import { WalkGrid } from '../src/engine/collision.ts';
import { cameraRelativeMove, cameraRightFromForward } from '../src/player/moveMath.ts';
import {
  applyKangxiWalk,
  applyYongzhengWalk,
  applyQianlongWalk
} from '../src/stages/walkLayouts.ts';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('ok  ', msg);
  }
}
function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

// --- Bug 2: camera right sign ---
{
  const r = cameraRightFromForward(0, 1);
  assert(approx(r.x, 1) && approx(r.z, 0), 'looking +Z, camera right is +X');
  const move = cameraRelativeMove(0, 1, 1, 0);
  assert(move.x > 0.9 && Math.abs(move.z) < 0.1, 'stick/key +X moves to camera right when looking +Z');
  const up = cameraRelativeMove(0, 1, 0, 1);
  assert(up.z > 0.9 && Math.abs(up.x) < 0.1, 'stick/key +Z (up) moves along camera forward +Z');
}
{
  const r = cameraRightFromForward(-1, 0);
  assert(approx(r.x, 0, 1e-5) && approx(r.z, 1, 1e-5), 'looking -X, camera right is +Z');
  const move = cameraRelativeMove(-1, 0, 1, 0);
  assert(move.z > 0.9 && Math.abs(move.x) < 0.1, 'stick +X moves +Z when camera looks -X');
}
{
  const r = cameraRightFromForward(1, 0);
  assert(approx(r.x, 0, 1e-5) && approx(r.z, -1, 1e-5), 'looking +X, camera right is -Z');
  const move = cameraRelativeMove(1, 0, 1, 0);
  assert(move.z < -0.9 && Math.abs(move.x) < 0.1, 'stick +X moves -Z when camera looks +X');
}
{
  const move = cameraRelativeMove(0, 1, 1, 0);
  assert(move.x > 0, 'must not be the left-handed forward×up left vector');
}

// --- Ramp / platform height (measured world AABBs) ---
{
  const grid = new WalkGrid(0.42);
  grid.addPlatform(7.93, 12.07, 4.93, 13.07, 1.1);
  grid.addRamp({
    minX: 5.8,
    maxX: 8.0,
    minZ: 8.9,
    maxZ: 13.1,
    y0: 0,
    y1: 1.1,
    axis: 'x',
    fromMin: true
  });

  assert(approx(grid.heightAt(10, 8), 1.1), 'Kangxi platform centre is 1.1');
  assert(approx(grid.heightAt(10, 4.5), 0), 'courtyard south of east terrace stays at 0 (t56)');
  assert(approx(grid.heightAt(-10, 4.5), 0), 'west court has no phantom platform (t56 west)');
  assert(approx(grid.heightAt(8.0, 11), 1.1, 1e-3), 'west ramp high (east) end is 1.1');
  assert(approx(grid.heightAt(5.8, 11), 0, 1e-3), 'west ramp low (west) end is 0');

  const xs = [5.8, 6.2, 6.6, 7.0, 7.4, 8.0];
  let last = -1;
  let rising = true;
  for (const x of xs) {
    const h = grid.heightAt(x, 11);
    if (h + 1e-6 < last) rising = false;
    last = h;
    console.log(`    kangxi ramp x=${x.toFixed(2)} height=${h.toFixed(3)}`);
  }
  assert(rising, 'Kangxi west ramp rises from 0 to 1.1 walking east');
  const mid = grid.heightAt(6.9, 11);
  assert(mid > 0.3 && mid < 0.9, `Kangxi mid-flight is between 0 and 1.1 (got ${mid})`);

  const edge = grid.heightAt(5.65, 11, 0.32);
  assert(edge > 0, `foot radius samples the ramp when root is just west of the low end (got ${edge})`);

  assert(approx(grid.heightAt(10, 4.7, 0.32), 0), 'foot radius must not lift south courtyard via the platform');
  assert(approx(grid.heightAt(6.9, 8.5, 0.32), 0), 'foot radius must not lift a player walking beside the stairs');
  assert(approx(grid.heightAt(-10, 8, 0.32), 0), 'west court is not lifted by a mirrored platform');
}

{
  const grid = new WalkGrid(0.42);
  grid.addPlatform(-2.07, 2.07, -10.07, -3.93, 1.1);
  grid.addRamp({
    minX: -2.1,
    maxX: 2.1,
    minZ: -4.65,
    maxZ: -2.45,
    y0: 0,
    y1: 1.1,
    axis: 'z',
    fromMin: false
  });
  assert(approx(grid.heightAt(0, -6), 1.1), 'Yongzheng dais platform is 1.1');
  assert(approx(grid.heightAt(0, -2.45), 0, 1e-3), 'Yongzheng ramp low (south) end is 0');
  assert(approx(grid.heightAt(0, -4.65), 1.1, 1e-3), 'Yongzheng ramp high (north) end is 1.1');
  const zs = [-2.45, -2.85, -3.25, -3.65, -4.05, -4.65];
  let last = -1;
  let rising = true;
  for (const z of zs) {
    const h = grid.heightAt(0, z);
    if (h + 1e-6 < last) rising = false;
    last = h;
    console.log(`    yongzheng ramp z=${z.toFixed(2)} height=${h.toFixed(3)}`);
  }
  assert(rising, 'Yongzheng dais ramp rises from 0 to 1.1 walking north');
  assert(approx(grid.heightAt(-1.8, -2.1), 0), 'official A not lifted by the ramp');
  assert(approx(grid.heightAt(1.9, -1.7), 0), 'official B not lifted by the ramp');
  assert(approx(grid.heightAt(-1.8, -2.1, 0.32), 0, 0.05), 'official A stays on the floor with foot radius');
  assert(approx(grid.heightAt(0, 2.0), 0), 'player spawn at z=2 stays at 0');
}

const KX_R = 0.42;
const YZ_R = 0.42;
const QL_R = 0.45;
const FOOT = 0.32;

function almostFree(grid: WalkGrid, x: number, z: number, slack = 0.08): boolean {
  const r = grid.resolve(x, z);
  return Math.hypot(r.x - x, r.z - z) <= slack;
}

function pushedOut(grid: WalkGrid, x: number, z: number, minPush = 0.15): boolean {
  const r = grid.resolve(x, z);
  return Math.hypot(r.x - x, r.z - z) >= minPush;
}

/** Follow a polyline in small steps; each step is run through resolve(). */
function follow(
  grid: WalkGrid,
  pts: Array<[number, number]>,
  label: string,
  step = 0.12,
  goalTol = 0.55
): { ok: boolean; x: number; z: number } {
  let x = pts[0][0];
  let z = pts[0][1];
  for (let p = 1; p < pts.length; p++) {
    const [gx, gz] = pts[p];
    let guard = 0;
    while (Math.hypot(gx - x, gz - z) > goalTol) {
      guard += 1;
      if (guard > 1200) {
        assert(false, `${label}: timeout heading to (${gx.toFixed(2)}, ${gz.toFixed(2)}) at (${x.toFixed(2)}, ${z.toFixed(2)})`);
        return { ok: false, x, z };
      }
      const d = Math.hypot(gx - x, gz - z);
      const nx = x + ((gx - x) / d) * step;
      const nz = z + ((gz - z) / d) * step;
      const res = grid.resolve(nx, nz);
      if (Math.hypot(res.x - x, res.z - z) < 0.008) {
        assert(false, `${label}: stuck at (${x.toFixed(2)}, ${z.toFixed(2)}) going to (${gx.toFixed(2)}, ${gz.toFixed(2)})`);
        return { ok: false, x, z };
      }
      x = res.x;
      z = res.z;
    }
  }
  assert(true, label);
  return { ok: true, x, z };
}

/** Follow a climbable ramp / deck and require height to track the surface. */
function followHeight(
  grid: WalkGrid,
  pts: Array<[number, number]>,
  label: string,
  expect: (x: number, z: number, y: number) => string | null,
  step = 0.12,
  goalTol = 0.4
): void {
  const walk = follow(grid, pts, label, step, goalTol);
  if (!walk.ok) return;
  let x = pts[0][0];
  let z = pts[0][1];
  for (let p = 1; p < pts.length; p++) {
    const [gx, gz] = pts[p];
    while (Math.hypot(gx - x, gz - z) > goalTol) {
      const d = Math.hypot(gx - x, gz - z);
      const res = grid.resolve(x + ((gx - x) / d) * step, z + ((gz - z) / d) * step);
      x = res.x;
      z = res.z;
      const y = grid.heightAt(x, z, FOOT);
      const err = expect(x, z, y);
      if (err) {
        assert(false, `${label}: ${err} at (${x.toFixed(2)}, ${z.toFixed(2)}) y=${y.toFixed(3)}`);
        return;
      }
    }
  }
}

{
  const grid = new WalkGrid(KX_R);
  applyKangxiWalk(grid);

  assert(approx(grid.heightAt(10, 4.5), 0), 'audit t56: courtyard south of east terrace y=0');
  assert(approx(grid.heightAt(10, 4.7, FOOT), 0), 'audit t56: foot radius must not lift south courtyard');
  assert(approx(grid.heightAt(-10, 4.5), 0), 'audit t56: west court y=0 (no mirrored platform)');
  assert(approx(grid.heightAt(-10, 8, FOOT), 0), 'audit: west court not lifted with foot radius');
  assert(approx(grid.heightAt(10, 8), 1.1), 'audit: throne terrace centre is 1.1');
  assert(approx(grid.heightAt(10, 5.8), 1.1), 'audit: 康熙 stand point is on the terrace');

  const white: Array<[string, number, number]> = [
    ['west pond coping mid', -0.55, 3.0],
    ['west pond coping south of bridge', -0.55, 4.0],
    ['east pond coping mid', 8.55, 3.0],
    ['east pond coping south of bridge', 8.55, 4.0],
    ['south outer coping', 4.0, -0.55],
    ['north outer coping', 4.0, 8.6],
    ['west court cobble', -11.0, 0.0],
    ['aisle cobble spawn', -3.2, 3.0],
    ['south of hall-front gap', 0.0, -0.4],
    ['east court cobble', 10.0, 2.0],
    ['han talk cobble', 12.15, 0.15],
    ['front-gate gap', 0.0, 14.0],
    ['meshy moon-gate opening', 9.3, -1.8],
    ['exit marker gap', 0.0, -3.35],
    ['pack moon-gate opening', -8.5, 11.0]
  ];
  for (const [name, x, z] of white) {
    assert(almostFree(grid, x, z), `Kangxi walkable: ${name} at (${x}, ${z})`);
    const y = grid.heightAt(x, z, FOOT);
    assert(y <= 0.2, `Kangxi ${name} stays near ground (y=${y.toFixed(3)})`);
  }

  const water: Array<[string, number, number]> = [
    ['pond centre', 4.0, 2.5],
    ['pond west', 2.0, 2.5],
    ['pond east', 6.0, 2.5],
    ['pond mid-south', 4.0, 3.5]
  ];
  for (const [name, x, z] of water) {
    assert(pushedOut(grid, x, z), `Kangxi water blocked: ${name}`);
    assert(approx(grid.heightAt(x, z, FOOT), 0), `Kangxi water ${name} has no walk height`);
  }

  assert(almostFree(grid, 4.0, 6.6), 'Kangxi bridge crown xz is open');
  const crownY = grid.heightAt(4.0, 6.6, FOOT);
  assert(crownY > 2.3 && crownY < 2.9, `Kangxi bridge crown height ~2.6 (got ${crownY.toFixed(3)})`);
  const westDeck = grid.heightAt(1.0, 6.6, FOOT);
  const eastDeck = grid.heightAt(7.0, 6.6, FOOT);
  assert(westDeck > 0.9 && westDeck < crownY, `Kangxi west bridge span rises (${westDeck.toFixed(3)})`);
  assert(eastDeck > 0.9 && eastDeck < crownY, `Kangxi east bridge span rises (${eastDeck.toFixed(3)})`);

  // Beside the deck / lions: must not float (t69u-1).
  assert(approx(grid.heightAt(0, 8.4, FOOT), 0), 'beside the bridge near the lions is ground, not a ramp');
  assert(approx(grid.heightAt(-2.0, 6.6, FOOT), 0, 0.05), 'west of the bridge approach stays near ground');

  assert(pushedOut(grid, 0, -8), 'Kangxi hall interior blocked');
  assert(pushedOut(grid, -8.0, 5.9), 'Kangxi rockery blocked');
  assert(pushedOut(grid, 9.5, -6.5), 'Kangxi well/bamboo blocked');
  assert(pushedOut(grid, -11.2, 8.6), 'Kangxi water pavilion blocked');
  assert(pushedOut(grid, 11.0, -0.6), 'Kangxi stool at (11.0,-0.6) blocked');
  assert(pushedOut(grid, -14.0, 0), 'Kangxi west outer wall blocked');

  follow(grid, [[-3.2, 3.0], [-0.55, 3.0]], 'walk spawn → west pond white coping');
  follow(grid, [[-3.2, 3.0], [0, -0.55], [4.0, -0.55]], 'walk spawn → south white coping');
  follow(grid, [[-3.2, 3.0], [-0.55, 6.6], [8.55, 6.6], [8.55, 3.0]], 'walk spawn → bridge → east pond white coping');
  followHeight(
    grid,
    [
      [-3.2, 3.0],
      [-0.55, 4.0],
      [-0.55, 6.6],
      [4.0, 6.6],
      [8.0, 6.6],
      [10.0, 6.6],
      [10.0, 5.8]
    ],
    'walk spawn → west coping → bridge deck → throne terrace → 康熙',
    (x, _z, y) => {
      if (x > 0.5 && x < 7.5 && y < 0.8) return `bridge deck too low (${y.toFixed(3)})`;
      if (x > 8.3 && y < 1.0) return `terrace approach too low (${y.toFixed(3)})`;
      return null;
    }
  );
  followHeight(
    grid,
    [
      [4.0, 12.2],
      [5.8, 12.2],
      [8.0, 12.2],
      [10.0, 11.0]
    ],
    'walk courtyard → west terrace stairs → throne terrace',
    (x, _z, y) => {
      if (x >= 5.85 && x <= 7.9 && (y < 0.05 || y > 1.15)) return `stair height out of range (${y.toFixed(3)})`;
      return null;
    }
  );
  follow(
    grid,
    [
      [-3.2, 3.0],
      [4.0, 10.0],
      [7.5, 8.35]
    ],
    'walk spawn → north of pond → 滿族人'
  );
  follow(
    grid,
    [
      [-3.2, 3.0],
      [-0.55, 6.6],
      [8.55, 6.6],
      [8.55, 3.0],
      [12.15, 3.0],
      [12.15, 0.15]
    ],
    'walk spawn → bridge → east court → 漢族人'
  );
  follow(grid, [[-3.2, 3.0], [0.0, -3.35]], 'walk spawn → hall-front exit gap');
  follow(grid, [[-3.2, 3.0], [-3.2, 10.0], [0.0, 14.0]], 'walk west court north → front-gate gap');
  follow(grid, [[12.15, 0.15], [12.15, -1.8], [9.3, -1.8]], 'walk 漢族人 cobble → meshy moon-gate opening');

  // Approach NPCs without the player floating on courtyard ground.
  assert(approx(grid.heightAt(7.5, 8.35, FOOT), 0), 'approach 滿族人 stays on the ground');
  assert(approx(grid.heightAt(12.15, 0.15, FOOT), 0), 'approach 漢族人 stays on the ground');
  const nearKx = grid.heightAt(10, 5.0, FOOT);
  assert(nearKx === 0 || approx(nearKx, 1.1), `south of 康熙 is ground or the terrace lip (got ${nearKx})`);

  let blockedCobble = 0;
  const hits: string[] = [];
  for (let x = -12; x <= 12; x += 0.5) {
    for (let z = -12; z <= 12; z += 0.5) {
      const pad = 0.5;
      const inWater = x >= 0.2 - pad && x <= 7.8 + pad && z >= 0.2 - pad && z <= 5.12 + pad;
      const inHall = x >= -7.55 - pad && x <= 7.55 + pad && z >= -13.2 - pad && z <= -1.15 + pad;
      const inWalls = x <= -13.2 + pad || x >= 13.2 - pad || z <= -13.2 + pad || z >= 13.2 - pad;
      const inRockery = x >= -9.75 - pad && x <= -6.45 + pad && z >= 4.74 - pad && z <= 7.16 + pad;
      const inWell = x >= 8.4 - pad && x <= 10.6 + pad && z >= -9.2 - pad && z <= -5.58 + pad;
      const inWestBamboo = x >= -10.6 - pad && x <= -8.4 + pad && z >= -4.0 - pad && z <= -2.15 + pad;
      const inPavSE = x >= 9.5 - pad && x <= 13.5 + pad && z >= -10.2 - pad && z <= -6.2 + pad;
      const inPavWest = x >= -13.55 - pad && x <= -8.85 + pad && z >= 6.25 - pad && z <= 10.95 + pad;
      const inGatePiers =
        (x >= -4.2 - pad && x <= -1.15 + pad && z >= 11.5 - pad && z <= 15.0 + pad) ||
        (x >= 1.15 - pad && x <= 4.2 + pad && z >= 11.5 - pad && z <= 15.0 + pad);
      const inMeshyGate =
        (x >= 8.39 - pad && x <= 10.21 + pad && z >= -5.03 - pad && z <= -2.95 + pad) ||
        (x >= 8.39 - pad && x <= 10.21 + pad && z >= -0.65 - pad && z <= 1.43 + pad);
      const inCourtMoon =
        (x >= -10.55 - pad && x <= -9.55 + pad && z >= 10.65 - pad && z <= 11.35 + pad) ||
        (x >= -7.45 - pad && x <= -6.45 + pad && z >= 10.65 - pad && z <= 11.35 + pad);
      if (
        inWater ||
        inHall ||
        inWalls ||
        inRockery ||
        inWell ||
        inWestBamboo ||
        inPavSE ||
        inPavWest ||
        inGatePiers ||
        inMeshyGate ||
        inCourtMoon
      ) {
        continue;
      }
      const props: Array<[number, number, number]> = [
        [-5.85, 0.4, 0.4],
        [-6.05, -3.9, 0.4],
        [2.15, -2.8, 0.4],
        [2.35, -5.6, 0.4],
        [6.4, -2.2, 0.4],
        [7.6, -4.8, 0.45],
        [10.4, -5.0, 0.45],
        [9.6, -8.6, 0.45],
        [4.8, 8.4, 0.4],
        [6.4, 10.6, 0.4],
        [11.0, -0.6, 0.35],
        [10.2, -6.2, 0.35],
        [6.0, -4.4, 0.35]
      ];
      if (props.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + 0.35)) continue;

      if (!almostFree(grid, x, z, 0.2)) {
        blockedCobble += 1;
        if (hits.length < 8) hits.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    }
  }
  assert(
    blockedCobble === 0,
    `Kangxi open cobble/path cells must be free (blocked ${blockedCobble}: ${hits.join(', ')})`
  );
}

{
  const grid = new WalkGrid(YZ_R);
  applyYongzhengWalk(grid);
  assert(almostFree(grid, 0, 2), 'Yongzheng spawn walkable');
  assert(approx(grid.heightAt(0, 2), 0), 'Yongzheng spawn y=0');
  assert(approx(grid.heightAt(-1.8, -2.1), 0), 'Yongzheng official A on floor');
  assert(approx(grid.heightAt(1.9, -1.7), 0), 'Yongzheng official B on floor');
  assert(approx(grid.heightAt(-1.8, -2.1, FOOT), 0, 0.05), 'Yongzheng official A not lifted with foot radius');
  assert(almostFree(grid, -8, 0), 'Yongzheng west court walkable');
  assert(almostFree(grid, 8, 0), 'Yongzheng east court walkable');
  assert(pushedOut(grid, 0, -14), 'Yongzheng hall interior blocked');
  assert(almostFree(grid, 0, 18), 'Yongzheng north gate gap walkable');
  follow(grid, [[0, 2], [-1.8, -2.1]], 'Yongzheng spawn → official A');
  followHeight(
    grid,
    [[0, 2], [0, -3.2], [0, -6.5]],
    'Yongzheng spawn → dais steps → 雍正',
    (x, z, y) => {
      if (Math.abs(x) > 0.6) return null;
      if (z <= -4.65 && !approx(y, 1.1, 0.05)) return `dais should be 1.1 (got ${y.toFixed(3)})`;
      // A few centimetres of lift just at the first step is expected with footR.
      if (z >= -2.2 && z <= 2 && y > 0.15) return `aisle should stay at 0 (got ${y.toFixed(3)})`;
      return null;
    }
  );
  const daisY = grid.heightAt(0, -6.5);
  assert(approx(daisY, 1.1), `Yongzheng dais under 雍正 is 1.1 (got ${daisY})`);
}

{
  const grid = new WalkGrid(QL_R);
  applyQianlongWalk(grid, true);
  assert(almostFree(grid, 0, 31.2), 'Qianlong shore spawn walkable');
  assert(pushedOut(grid, 30, -10), 'Qianlong open sea south of dock blocked');
  assert(pushedOut(grid, 30, 20), 'Qianlong open sea north of dock blocked');
  assert(almostFree(grid, 20, 2.0), 'Qianlong dock corridor walkable');
  assert(almostFree(grid, 22, 0.4), 'Qianlong dock south half walkable');
  assert(almostFree(grid, 22, 3.7), 'Qianlong dock north half walkable');
  assert(pushedOut(grid, 22, 4.8), 'Qianlong sea just north of dock blocked');
  assert(pushedOut(grid, 22, -0.8), 'Qianlong sea just south of dock blocked');
  assert(pushedOut(grid, 30, 2.0), 'Qianlong ship-end block still on before password');

  assert(almostFree(grid, 14, 12), 'Qianlong coast-bridge south approach is open');
  assert(almostFree(grid, 14, 18), 'Qianlong coast-bridge crown xz is open');
  const qlCrown = grid.heightAt(14, 18, FOOT);
  assert(qlCrown > 2.4 && qlCrown < 3.1, `Qianlong coast-bridge crown ~2.75 (got ${qlCrown.toFixed(3)})`);
  followHeight(
    grid,
    [
      [14, 12],
      [14, 18],
      [14, 22]
    ],
    'walk Qianlong shore → coast-bridge deck → north bank',
    (x, z, y) => {
      if (Math.abs(x - 14) > 0.6) return null;
      if (z > 14.2 && z < 21.6 && y < 0.5) return `bridge deck too low (${y.toFixed(3)})`;
      return null;
    }
  );
  follow(grid, [[0, 31.2], [0, 36.4]], 'walk Qianlong shore → 乾隆');
  follow(grid, [[16, 6], [18.6, 2.0], [22, 2.0]], 'walk Qianlong shore → dock');
  assert(approx(grid.heightAt(0, 36.4, FOOT), 0, 0.2), 'approach 乾隆 stays near ground');

  const open = new WalkGrid(QL_R);
  applyQianlongWalk(open, false);
  assert(almostFree(open, 28, 2.0), 'Qianlong dock extends toward the hull after password');
  follow(open, [[22, 2.0], [28, 2.0]], 'walk dock toward flagship after password');
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall walk / movement checks passed');
