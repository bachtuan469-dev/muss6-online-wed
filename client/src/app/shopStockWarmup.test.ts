import { describe, expect, it, vi } from 'vitest';
import { LEO_NPC_TYPE } from '@/modules/npc_shop/shopStock';
import { shopStockWarmup } from './shopStockWarmup';

describe('the shop stock warm-up at world entry', () => {
  it('starts Leo’s stock once, the first time the hero is in the world', () => {
    const prefetch = vi.fn();
    let inWorld = false;
    const onWarp = shopStockWarmup(() => inWorld, prefetch);

    onWarp(); // the character screen: not yet
    expect(prefetch).not.toHaveBeenCalled();

    inWorld = true;
    onWarp();
    onWarp(); // a later warp: already warm
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith(LEO_NPC_TYPE);
  });
});
