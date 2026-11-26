import { LEO_NPC_TYPE } from '@/modules/npc_shop/shopStock';

/**
 * Ours (slice 3 of the glow-097 fix): the first time the hero is in the world, Leo's shop stock
 * starts drawing at once, so opening his shop later finds the pictures already in. The stock
 * is the server's snapshot (`modules/npc_shop/shopStock.ts`); the window itself still takes its
 * stock from the server's StoreItemList packet when it opens. Returns the `warpCompleted`
 * handler boot installs, next to `townPrefetch`.
 *
 * Leo only, not every merchant: his 62 model files are ~10 s of background fetch on a cold
 * cache, while all 27 shops are 452 pairs (Lorencia alone is 331) - minutes of traffic at world
 * entry, for shops the hero may never open. The other shops warm when they open, as before, and
 * their stills now survive a reload (`render/iconStillCache.ts`).
 */
export function shopStockWarmup(
  inWorld: () => boolean,
  prefetch: (npcType: number) => void
): () => void {
  let warmed = false;
  return () => {
    if (warmed || !inWorld()) return;
    warmed = true;
    prefetch(LEO_NPC_TYPE);
  };
}
