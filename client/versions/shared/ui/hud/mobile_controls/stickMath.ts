/**
 * The touch stick's geometry. A pointer offset from the base's centre, in
 * pixels, becomes the vector the walk reads (`world.stickMove`): screen axes
 * (x right, y down), each within -1..1, the length capped at 1 however far
 * past the rim the finger slides. Inside the deadzone the stick counts as
 * centred and the answer is null, which is what stops the walk.
 */
export const STICK_DEADZONE = 0.35;

export function stickVector(
  dx: number,
  dy: number,
  radius: number
): { x: number; y: number } | null {
  if (radius <= 0) return null;
  let x = dx / radius;
  let y = dy / radius;
  const length = Math.hypot(x, y);
  if (length < STICK_DEADZONE) return null;
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x, y };
}
