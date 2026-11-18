/**
 * WalkGrid volumes for all three stages, kept in one place so the stage
 * loaders and scripts/check-walk.ts cannot drift apart.
 *
 * Kangxi pond / bridge numbers come from measured Babylon AABBs
 * (courtyard.glb + pack lotus-pond-edge with Matrix.RotationY):
 *   water modules          X[-8.00, 0.00] Z[ 0.00, 8.00]
 *   west outer coping      X[-9.010,-8.150] Z[0, 8]
 *   east outer coping      X[ 0.150, 1.010] Z[0, 8]
 *   south outer coping     X[-8.00, 0.00] Z[-1.010,-0.150]
 *   north outer coping     X[-8.00, 0.00] Z[ 8.150, 9.010]
 *   west aisle coping _0   X[-5.910,-5.050] Z[0, 8]
 *   east aisle coping _0   X[-1.350,-0.490] Z[0, 8]
 *   arched-stone-bridge    X[-8.200, 0.200] Z[ 5.100, 8.100]
 *                          deck ≈ 0.85 at the banks, ≈ 2.60 at the crown (x=-4)
 *
 * Solids are 2D in XZ, so a walkable bridge deck has to be a gap in the
 * water solids plus ramps — a "gap" at ground under the arch is water.
 */
import { WalkGrid } from '../engine/collision.ts';

export const QL_SHIP_BLOCK = { minX: 24.6, maxX: 90, minZ: -0.15, maxZ: 4.15 };

export function applyKangxiWalk(grid: WalkGrid): void {
  // Outer walls (gate gap around x=[-5.4, 5.4], z=14)
  grid.addSolid(-15.2, -13.2, -15.2, 15.2);
  grid.addSolid(13.2, 15.2, -15.2, 15.2);
  grid.addSolid(-15.2, 15.2, -15.2, -13.2);
  grid.addSolid(-15.2, -5.4, 13.2, 15.2);
  grid.addSolid(5.4, 15.2, 13.2, 15.2);
  // Gate tower piers, leave a central passage
  grid.addSolid(-4.2, -1.15, 11.5, 15.0, 0, 11);
  grid.addSolid(1.15, 4.2, 11.5, 15.0, 0, 11);
  // Ceremonial hall interior. Front central stairs are decorative and
  // lead into this solid, so they stay at ground height (no ramp) to
  // avoid trapping the player on the 台基.
  grid.addSolid(-5.2, 5.2, -13.2, -4.15, 0, 13);
  // Raised 台基 wings / cheeks (measured base X[-7.57,7.57] Z[-13.57,-1.10]),
  // leaving a central stair gap around |x|<2.2. Does not extend onto the
  // empty cobble north of z≈-1.1 (stool at 7.2,-0.6 stays clear).
  grid.addSolid(-7.55, -5.2, -13.2, -1.15, 0, 2.2);
  grid.addSolid(5.2, 7.55, -13.2, -1.15, 0, 2.2);
  grid.addSolid(-5.2, -2.2, -4.15, -1.15, 0, 2.2);
  grid.addSolid(2.2, 5.2, -4.15, -1.15, 0, 2.2);

  // Visible lotus water only, inset slightly so a 0.42 radius can stand on
  // the 汉白玉 copings. The aisle between the pack lips and the outer
  // copings stay open. The bridge deck XZ is a gap: ramps lift the player.
  // West pond, south of the bridge.
  grid.addSolid(-8.00, -6.20, 0.30, 5.12);
  // East / centre pond, south of the bridge.
  grid.addSolid(-0.20, 0.02, 0.30, 5.12);

  // Arched stone bridge, east-west over both ponds (crown at x=-4).
  grid.addRamp({
    minX: -8.2,
    maxX: -4.0,
    minZ: 5.12,
    maxZ: 8.08,
    y0: 1.1,
    y1: 2.6,
    axis: 'x',
    fromMin: true
  });
  grid.addRamp({
    minX: -4.0,
    maxX: 0.2,
    minZ: 5.12,
    maxZ: 8.08,
    y0: 2.6,
    y1: 0.12,
    axis: 'x',
    fromMin: true
  });

  // Actual remaining rockery outcrop (measured Babylon AABB
  // X[6.490, 9.708] Z[4.782, 7.124]).
  grid.addSolid(6.45, 9.75, 4.74, 7.16, 0, 3.0);
  // Well + the bamboo clump beside it (measured well X[-10.53,-8.04]
  // Z[-7.30,-5.70]; bamboo X[-10.29,-8.56] Z[-9.06,-6.96]).
  grid.addSolid(-10.65, -7.95, -9.20, -5.58, 0, 3.0);

  // Meshy moon-gate wall wings (opening stays walkable) and pavilion footprint.
  // MESHY_COURT.moonGate (9.3, -1.8, scale 3.4, rotY=π/2); opening 1.15.
  grid.addSolid(8.3874, 10.2126, -5.0266, -2.95, 0, 6.5);
  grid.addSolid(8.3874, 10.2126, -0.65, 1.4266, 0, 6.5);
  // MESHY_COURT.pavilion (11.5, -8.2, scale 3.5)
  grid.addSolid(9.50675, 13.49325, -10.19325, -6.20675, 0, 7.5);

  // Courtyard-pack moon gate in the NE wall (node at 8.5, 11; wall
  // X[6.50,10.50] Z[10.72,11.28]). Leave a ~2 m circular opening at x=8.5.
  grid.addSolid(6.45, 7.45, 10.65, 11.35, 0, 3.6);
  grid.addSolid(9.55, 10.55, 10.65, 11.35, 0, 3.6);

  // Pack water pavilion was moved from (-5, 2.5) to (11.2, 8.6).
  // Base 5×5: X[8.70,13.70] Z[6.10,11.10]. Tightened slightly.
  grid.addSolid(8.85, 13.55, 6.25, 10.95, 0, 7.5);

  // Meshy peony pots (~scale 0.42–0.5, xz radius ≈ 0.92) and drum stools (~scale 0.36).
  const peonySolids: Array<[number, number, number]> = [
    [-5.85, 0.4, 0.42],
    [-6.05, -3.9, 0.42],
    [2.15, -2.8, 0.42],
    [2.35, -5.6, 0.42],
    [6.4, -2.2, 0.45],
    [7.6, -4.8, 0.48],
    [10.4, -5.0, 0.5],
    [9.6, -8.6, 0.5],
    [4.8, 8.4, 0.42],
    [6.4, 10.6, 0.42]
  ];
  for (const [x, z, s] of peonySolids) {
    const r = 0.92 * s * 0.7;
    grid.addSolid(x - r, x + r, z - r, z + r, 0, 1.8);
  }
  const stoolSolids: Array<[number, number]> = [
    [7.2, -0.6],
    [10.2, -6.2],
    [6.0, -4.4]
  ];
  for (const [x, z] of stoolSolids) {
    const r = 0.9 * 0.36 * 0.75;
    grid.addSolid(x - r, x + r, z - r, z + r, 0, 1.0);
  }

  // West throne terrace: two pack modules at (-10, 7) and (-10, 11). Collision
  // covers only the walkable top (y=1.1), not the skirt or the courtyard
  // south of z≈5.07. East step-flight is a ramp, not a flat 1.1 slab.
  grid.addPlatform(-11.93, -8.07, 5.07, 12.93, 1.1);
  // Roofs / walkway eaves: block the camera but not the player.
  grid.addCameraSolid(-14.4, -11.6, -8.5, 2.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -12.5, 9.5, 2.5, 7.5);
  grid.addCameraSolid(-13.5, -7.4, 4.6, 13.4, 3.2, 8.0);
  grid.addCameraSolid(-14.4, -11.6, 2.0, 6.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -6.5, -1.5, 2.5, 7.5);

  // East step-flight measured X[-8.000,-5.800] Z[8.900,13.100], high at
  // the west (platform) end, low at the east.
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
}

export function applyYongzhengWalk(grid: WalkGrid): void {
  grid.addSolid(-19.2, -17.2, -19.2, 19.2);
  grid.addSolid(17.2, 19.2, -19.2, 19.2);
  grid.addSolid(-19.2, -4.0, 17.2, 19.2);
  grid.addSolid(4.0, 19.2, 17.2, 19.2);
  grid.addSolid(-19.2, -2.4, -19.2, -17.2);
  grid.addSolid(2.4, 19.2, -19.2, -17.2);
  grid.addSolid(-4.2, -1.15, 14.6, 18.4, 0, 11);
  grid.addSolid(1.15, 4.2, 14.6, 18.4, 0, 11);
  grid.addSolid(-5.4, 5.4, -17.2, -10.2, 0, 13);
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
}

export function applyQianlongWalk(grid: WalkGrid, shipBlocked = true): void {
  grid.addSolid(-46, -44, -28, 52);
  grid.addSolid(-46, 18, 50, 52);
  grid.addSolid(-46, 18, -28, -26);
  // Sea is not walkable except the pier / dock corridor. Dock plank after
  // rotY=π/2 at (22, 2.0): X[17.0, 27.0] Z[-0.10, 4.10].
  grid.addSolid(18.5, 90, -40, -0.15);
  grid.addSolid(18.5, 90, 4.15, 50);
  if (shipBlocked) {
    const b = QL_SHIP_BLOCK;
    grid.addSolid(b.minX, b.maxX, b.minZ, b.maxZ);
  }
  grid.addSolid(-4.2, 4.2, 38.8, 44.0, 0, 12);
  grid.addSolid(-31.5, -24.8, 7.2, 13.2, 0, 8);
  // Meshy shore pavilion footprint (scale 4.2, xz radius ≈ 0.67).
  grid.addSolid(13.9, 18.5, 9.9, 14.5, 0, 9);
  const pr = 0.92 * 0.5 * 0.7;
  grid.addSolid(15.2 - pr, 15.2 + pr, 9.6 - pr, 9.6 + pr, 0, 1.8);
  grid.addSolid(17.4 - pr, 17.4 + pr, 14.4 - pr, 14.4 + pr, 0, 1.8);
  const sr = 0.9 * 0.36 * 0.75;
  grid.addSolid(15.4 - sr, 15.4 + sr, 5.4 - sr, 5.4 + sr, 0, 1.0);

  // Coast arched stone-bridge at (14, -0.2, 18) rotY=π/2:
  // world X[12.50, 15.50] Z[13.80, 22.20], crown at z=18, deck ≈ 1.00 / 2.75.
  grid.addRamp({
    minX: 12.55,
    maxX: 15.45,
    minZ: 13.8,
    maxZ: 18.0,
    y0: 0.15,
    y1: 2.75,
    axis: 'z',
    fromMin: true
  });
  grid.addRamp({
    minX: 12.55,
    maxX: 15.45,
    minZ: 18.0,
    maxZ: 22.2,
    y0: 2.75,
    y1: 0.15,
    axis: 'z',
    fromMin: true
  });
}

export function isQianlongShipBlock(s: { minX: number; maxZ?: number }): boolean {
  return s.minX === QL_SHIP_BLOCK.minX && s.maxZ === QL_SHIP_BLOCK.maxZ;
}
