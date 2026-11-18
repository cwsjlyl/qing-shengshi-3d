/**
 * WalkGrid volumes for all three stages, kept in one place so the stage
 * loaders and scripts/check-walk.ts cannot drift apart.
 *
 * Kangxi numbers are world AABBs from a fully dressed scene
 * (courtyard.glb + dressCourtyard + dressKangxiPack + characters).
 * t68u had the same meshes with the X axis mirrored (water / bridge /
 * terrace / well / rockery / moon-gate / pavilion all flipped). Do not
 * reuse those X ranges.
 *
 *   water modules          X[ 0.00,  8.00] Z[ 0.00,  8.00]
 *   west outer coping      X[-1.010,-0.150] Z[0, 8]
 *   east outer coping      X[ 8.150, 9.010] Z[0, 8]
 *   south outer coping     X[ 0.00,  8.00] Z[-1.010,-0.150]
 *   north outer coping     X[ 0.00,  8.00] Z[ 8.150, 9.010]
 *   arched-stone-bridge    node (4.0, -0.35, 6.6)
 *                          X[-0.200, 8.200] Z[ 5.100, 8.100]
 *                          deck ≈ 0.85 at the banks, ≈ 2.60 at the crown (x=4)
 *   terrace modules        nodes (10, 7) and (10, 11), top y=1.1
 *                          X[ 7.930, 12.070] Z[ 4.930, 13.070]
 *   west step-flight       node (7.12, -0.05, 11)
 *                          X[ 5.800,  8.000] Z[ 8.900, 13.100]
 *                          high at x=8.00 (terrace), low at x=5.80
 *   throne                 (10, 1.1, 7), footstool (10, 1.1, 8.4)
 *   guardian lions         (0, 9.2)  X[-1.35, 1.35] Z[8.55, 10.01]
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
  // avoid trapping the player on the 台基. Screenshot t69u-1 is the
  // grey arched pond bridge beside the north lions, not these stairs.
  grid.addSolid(-5.2, 5.2, -13.2, -4.15, 0, 13);
  // Raised 台基 wings / cheeks (measured base X[-7.57,7.57] Z[-13.57,-1.10]),
  // leaving a central stair gap around |x|<2.2. Does not extend onto the
  // empty cobble north of z≈-1.1 (stool at 7.2,-0.6 stays clear).
  grid.addSolid(-7.55, -5.2, -13.2, -1.15, 0, 2.2);
  grid.addSolid(5.2, 7.55, -13.2, -1.15, 0, 2.2);
  grid.addSolid(-5.2, -2.2, -4.15, -1.15, 0, 2.2);
  grid.addSolid(2.2, 5.2, -4.15, -1.15, 0, 2.2);

  // Visible lotus water only, south of the arched bridge. Inset slightly
  // so a 0.42 radius can stand on the 汉白玉 copings. The bridge deck XZ
  // is a gap: ramps lift the player.
  grid.addSolid(0.2, 7.8, 0.2, 5.12);

  // Arched stone bridge, east-west over the pond (crown at x=4).
  // Z is inset from the full mesh AABB Z[5.10, 8.10] so walking beside
  // the deck (lions at z≈9.2, or the water's edge) is not lifted.
  // A short west approach takes the player from the coping up onto the bank.
  grid.addRamp({
    minX: -1.05,
    maxX: -0.2,
    minZ: 5.25,
    maxZ: 7.95,
    y0: 0,
    y1: 0.85,
    axis: 'x',
    fromMin: true
  });
  grid.addRamp({
    minX: -0.2,
    maxX: 4.0,
    minZ: 5.25,
    maxZ: 7.95,
    y0: 0.85,
    y1: 2.6,
    axis: 'x',
    fromMin: true
  });
  grid.addRamp({
    minX: 4.0,
    maxX: 8.2,
    minZ: 5.25,
    maxZ: 7.95,
    y0: 2.6,
    y1: 0.85,
    axis: 'x',
    fromMin: true
  });

  // Rockery outcrop, world AABB X[-9.708, -6.490] Z[4.782, 7.124].
  grid.addSolid(-9.75, -6.45, 4.74, 7.16, 0, 3.0);
  // Well + the bamboo clump beside it (well X[8.47,10.53] Z[-7.30,-5.70];
  // bamboo 175 X[8.56,10.29] Z[-9.06,-6.96]).
  grid.addSolid(8.4, 10.6, -9.2, -5.58, 0, 3.0);
  // Remaining west-court bamboo clump at (-9.5, -3).
  grid.addSolid(-10.6, -8.4, -4.0, -2.15, 0, 4.4);

  // Meshy moon-gate wall wings (opening stays walkable) and pavilion footprint.
  // MESHY_COURT.moonGate (9.3, -1.8, scale 3.4, rotY=π/2); opening 1.15.
  grid.addSolid(8.3874, 10.2126, -5.0266, -2.95, 0, 6.5);
  grid.addSolid(8.3874, 10.2126, -0.65, 1.4266, 0, 6.5);
  // MESHY_COURT.pavilion (11.5, -8.2, scale 3.5)
  grid.addSolid(9.50675, 13.49325, -10.19325, -6.20675, 0, 7.5);

  // Courtyard-pack moon gate in the NW wall (node at -8.5, 11; wall
  // X[-10.50,-6.50] Z[10.72,11.28]). Leave a ~2 m circular opening at x=-8.5.
  grid.addSolid(-10.55, -9.55, 10.65, 11.35, 0, 3.6);
  grid.addSolid(-7.45, -6.45, 10.65, 11.35, 0, 3.6);

  // Pack water pavilion, world position (-11.2, 8.6). Base ~5×5
  // X[-13.70,-8.70] Z[6.10,11.10], tightened to the deck mesh.
  grid.addSolid(-13.55, -8.85, 6.25, 10.95, 0, 7.5);

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
    [11.0, -0.6],
    [10.2, -6.2],
    [6.0, -4.4]
  ];
  for (const [x, z] of stoolSolids) {
    const r = 0.9 * 0.36 * 0.75;
    grid.addSolid(x - r, x + r, z - r, z + r, 0, 1.0);
  }

  // East throne terrace: two pack modules at (10, 7) and (10, 11). Collision
  // covers only the walkable top (y=1.1), not the skirt or the courtyard
  // south of z≈4.93. West step-flight is a ramp, not a flat 1.1 slab.
  grid.addPlatform(7.93, 12.07, 4.93, 13.07, 1.1);
  // Roofs / walkway eaves: block the camera but not the player.
  grid.addCameraSolid(-14.4, -11.6, -8.5, 2.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -12.5, 9.5, 2.5, 7.5);
  grid.addCameraSolid(7.5, 12.5, 4.6, 13.4, 3.2, 8.0);
  grid.addCameraSolid(-14.5, -7.9, 5.3, 11.9, 2.5, 8.0);
  grid.addCameraSolid(-14.4, -11.6, 2.0, 6.5, 2.5, 6.5);
  grid.addCameraSolid(10.2, 14.4, -6.5, -1.5, 2.5, 7.5);

  // West step-flight of the east terrace: X[5.800, 8.000] Z[8.900, 13.100],
  // high at the east (platform) end, low at the west.
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
  // Two terrace modules: X[-2.07, 2.07] Z[-10.07, -3.93], top y=1.1.
  grid.addPlatform(-2.07, 2.07, -10.07, -3.93, 1.1);
  // dais-steps at (0, -3.77): high under the dais at z=-4.65, low at z=-2.45.
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
  // Meshy shore pavilion at (16.2, 12.2). Keep the solid east of the
  // coast-bridge deck X[12.50, 15.50] so the south approach stays open.
  grid.addSolid(15.55, 18.7, 9.9, 14.5, 0, 9);
  const pr = 0.92 * 0.5 * 0.7;
  grid.addSolid(15.2 - pr, 15.2 + pr, 9.6 - pr, 9.6 + pr, 0, 1.8);
  grid.addSolid(17.4 - pr, 17.4 + pr, 14.4 - pr, 14.4 + pr, 0, 1.8);
  const sr = 0.9 * 0.36 * 0.75;
  grid.addSolid(15.4 - sr, 15.4 + sr, 5.4 - sr, 5.4 + sr, 0, 1.0);

  // Coast arched stone-bridge at (14, -0.2, 18) rotY=π/2:
  // world X[12.50, 15.50] Z[13.80, 22.20], crown at z=18, deck ≈ 1.00 / 2.75.
  // X inset slightly so walking beside the deck is not lifted.
  grid.addRamp({
    minX: 12.6,
    maxX: 15.4,
    minZ: 13.8,
    maxZ: 18.0,
    y0: 0.15,
    y1: 2.75,
    axis: 'z',
    fromMin: true
  });
  grid.addRamp({
    minX: 12.6,
    maxX: 15.4,
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
