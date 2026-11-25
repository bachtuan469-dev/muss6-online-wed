import { describe, expect, it } from 'vitest';
import type { Item } from '@/ecs/world';
import { pinnedTipAction } from './pinnedTip';

/**
 * FIX24 Việc 7: a held item shows its tooltip, and the tooltip carries
 * one action button for what the right click would have done with it.
 * The label is the item's intrinsic action: a skill orb is learned, a
 * potion is drunk, a piece of gear is worn. Anything else (a jewel, a
 * ticket, a quest item) gets no button - the tooltip still shows.
 */
describe('pinnedTipAction', () => {
  const worn: (Item | null)[] = [];

  it('learns a skill orb', () => {
    // Group 12, index 7: Orb of Twisting Slash, teaches skill 41.
    expect(pinnedTipAction({ group: 12, num: 7 } as unknown as Item, worn)).toBe('learn');
  });

  it('drinks a potion', () => {
    // Group 14, index 0: a potion the bar drinks.
    expect(pinnedTipAction({ group: 14, num: 0 } as unknown as Item, worn)).toBe('use');
  });

  it('wears a piece of gear with a free slot', () => {
    // Group 0, index 0: a sword with somewhere to go.
    expect(pinnedTipAction({ group: 0, num: 0 } as unknown as Item, worn)).toBe('equip');
  });

  it('offers nothing when every gear slot is taken', () => {
    const full = new Array<Item | null>(8).fill({ group: 0, num: 0 } as unknown as Item);
    expect(pinnedTipAction({ group: 0, num: 0 } as unknown as Item, full)).toBe(null);
  });

  it('offers nothing for a jewel', () => {
    // Group 14, index 13: a Jewel of Bless - not drunk, not worn.
    expect(pinnedTipAction({ group: 14, num: 13 } as unknown as Item, worn)).toBe(null);
  });
});
