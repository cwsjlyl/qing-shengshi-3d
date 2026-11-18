/**
 * Camera-relative XZ movement helpers.
 *
 * Babylon's world is left-handed, but Vector3.Cross uses the right-handed
 * formula. That means `forward × up` is the *left* vector (e.g. (0,0,1)×(0,1,0)
 * = (-1,0,0)). Camera-right is `up × forward`, i.e. (fz, 0, -fx).
 */

export function cameraRightFromForward(fx: number, fz: number): { x: number; z: number } {
  const len = Math.hypot(fz, -fx);
  if (len < 1e-8) return { x: 1, z: 0 };
  return { x: fz / len, z: -fx / len };
}

/** mx > 0 is stick/key right (camera right); mz > 0 is stick/key up (camera forward). */
export function cameraRelativeMove(
  fx: number,
  fz: number,
  mx: number,
  mz: number
): { x: number; z: number } {
  const fl = Math.hypot(fx, fz);
  const forward = fl > 1e-8 ? { x: fx / fl, z: fz / fl } : { x: 0, z: 1 };
  const right = cameraRightFromForward(forward.x, forward.z);
  return { x: forward.x * mz + right.x * mx, z: forward.z * mz + right.z * mx };
}
