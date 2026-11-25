/**
 * How far a touch pick looks for a monster when nothing is targeted, in
 * tiles: roughly what stands on screen around the hero. Past it the pick
 * does nothing rather than sending the hero across the map. Owned by
 * `attackSystem` (the per-frame aim system reads it too); re-exported here
 * so the touch callers keep their import.
 */
import { ATTACK_PICK_RANGE_TILES } from '@/ecs/systems/attackSystem';

export { ATTACK_PICK_RANGE_TILES };

/**
 * The nearest candidate to the hero, by tile distance truncated the way
 * `AttackSystem` measures it, or null when none is within `maxTiles`.
 * The first of equals wins, so the pick never flickers between two
 * monsters standing symmetric.
 */
export function nearestTarget<T>(
  heroX: number,
  heroZ: number,
  candidates: readonly { target: T; x: number; z: number }[],
  maxTiles: number = ATTACK_PICK_RANGE_TILES
): T | null {
  const hx = ~~heroX;
  const hz = ~~heroZ;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = ~~c.x - hx;
    const dz = ~~c.z - hz;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = c.target;
    }
  }
  return best !== null && bestDist <= maxTiles * maxTiles ? best : null;
}
