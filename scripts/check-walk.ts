/**
 * Unit checks for stair height and camera-relative movement.
 * Run: node --experimental-strip-types scripts/check-walk.ts
 */
import { WalkGrid } from '../src/engine/collision.ts';
import { cameraRelativeMove, cameraRightFromForward } from '../src/player/moveMath.ts';

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
  // Camera looking -X (alpha pointing west): forward (-1,0,0), right should be +Z? 
  // up × forward: (0,1,0)×(-1,0,0) = (0,0,1)? RH: i(0-0)-j(0-0)+k(0-(-1)) = (0,0,1). Yes +Z.
  const r = cameraRightFromForward(-1, 0);
  assert(approx(r.x, 0, 1e-5) && approx(r.z, 1, 1e-5), 'looking -X, camera right is +Z');
  const move = cameraRelativeMove(-1, 0, 1, 0);
  assert(move.z > 0.9 && Math.abs(move.x) < 0.1, 'stick +X moves +Z when camera looks -X');
}
{
  // Looking +X: forward (1,0,0), right = (0,0,-1)
  const r = cameraRightFromForward(1, 0);
  assert(approx(r.x, 0, 1e-5) && approx(r.z, -1, 1e-5), 'looking +X, camera right is -Z');
  const move = cameraRelativeMove(1, 0, 1, 0);
  assert(move.z < -0.9 && Math.abs(move.x) < 0.1, 'stick +X moves -Z when camera looks +X');
}
{
  // The old bug: forward × up would give LEFT. Ensure we did not invert both axes.
  const move = cameraRelativeMove(0, 1, 1, 0);
  assert(move.x > 0, 'must not be the left-handed forward×up left vector');
}

// --- Bug 1: height along intended ramps ---
{
  const grid = new WalkGrid(0.42);
  // Kangxi west terrace + east flight (widened approach)
  grid.addPlatform(-11.93, -8.07, 5.07, 12.93, 1.1);
  grid.addRamp({
    minX: -8.07,
    maxX: -5.5,
    minZ: 8.75,
    maxZ: 13.25,
    y0: 0,
    y1: 1.1,
    axis: 'x',
    fromMin: false
  });

  assert(approx(grid.heightAt(-10, 8), 1.1), 'Kangxi platform centre is 1.1');
  assert(approx(grid.heightAt(-10, 4.5), 0), 'courtyard south of platform stays at 0 (t56)');
  assert(approx(grid.heightAt(-8.07, 11), 1.1, 1e-3), 'east ramp high (west) end is 1.1');
  assert(approx(grid.heightAt(-5.5, 11), 0, 1e-3), 'east ramp low (east) end is 0');

  const xs = [-5.5, -6.0, -6.5, -7.0, -7.5, -8.07];
  let last = -1;
  let rising = true;
  for (const x of xs) {
    const h = grid.heightAt(x, 11);
    if (h + 1e-6 < last) rising = false;
    last = h;
    console.log(`    kangxi ramp x=${x.toFixed(2)} height=${h.toFixed(3)}`);
  }
  assert(rising, 'Kangxi east ramp rises from 0 to 1.1 walking west');
  const mid = grid.heightAt(-6.8, 11);
  assert(mid > 0.3 && mid < 0.9, `Kangxi mid-flight is between 0 and 1.1 (got ${mid})`);

  // Foot radius: root just east of the visual low end still gets a little height
  const edge = grid.heightAt(-5.35, 11, 0.32);
  assert(edge > 0, `foot radius samples the ramp when root is just outside (got ${edge})`);

  // Must not lift a player standing on courtyard south of the terrace (t56)
  assert(approx(grid.heightAt(-10, 4.7, 0.32), 0), 'foot radius must not lift south courtyard via the platform');
}

{
  const grid = new WalkGrid(0.42);
  grid.addPlatform(-2.05, 2.05, -10.0, -4.0, 1.1);
  grid.addRamp({
    minX: -2.25,
    maxX: 2.25,
    minZ: -4.25,
    maxZ: -2.25,
    y0: 0,
    y1: 1.1,
    axis: 'z',
    fromMin: false
  });
  assert(approx(grid.heightAt(0, -6), 1.1), 'Yongzheng dais platform is 1.1');
  assert(approx(grid.heightAt(0, -2.25), 0, 1e-3), 'Yongzheng ramp low (south) end is 0');
  assert(approx(grid.heightAt(0, -4.25), 1.1, 1e-3), 'Yongzheng ramp high (north) end is 1.1');
  const zs = [-2.25, -2.65, -3.05, -3.45, -3.85, -4.25];
  let last = -1;
  let rising = true;
  for (const z of zs) {
    const h = grid.heightAt(0, z);
    if (h + 1e-6 < last) rising = false;
    last = h;
    console.log(`    yongzheng ramp z=${z.toFixed(2)} height=${h.toFixed(3)}`);
  }
  assert(rising, 'Yongzheng dais ramp rises from 0 to 1.1 walking north');
  // Officials at z=-2.1 / -1.7 must stay on the floor
  assert(approx(grid.heightAt(-1.8, -2.1), 0), 'official A not lifted by the ramp');
  assert(approx(grid.heightAt(1.9, -1.7), 0), 'official B not lifted by the ramp');
  // Aisle in front of the dais, away from the stairs
  assert(approx(grid.heightAt(0, 2.0), 0), 'player spawn at z=2 stays at 0');
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall walk / movement checks passed');
