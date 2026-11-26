import { describe, expect, it } from 'vitest';
import type { Item } from '../../ecs/world';
import {
  itemValue,
  npcBuyPrice,
  npcRepairAllCost,
  npcRepairCost,
  npcSellPrice,
} from './itemValue';

const at = (group: number, num: number, durability?: number) =>
  ({ group, num, durability }) as unknown as Item;

// The NPC shop prices (FIX34): the server sells for a fiftieth of the
// automatic prices (`ItemPriceCalculator.NpcShopPriceDivisor` = 50), so the
// client has to show the same divided prices or the buy gate refuses what
// the player can afford. The classic `itemValue` stays untouched: the chaos
// mix still uses it as its crafting reference price.
describe('the NPC shop buying price', () => {
  it('is the classic price divided by 50', () => {
    // Jewel of Bless / Soul / Chaos have fixed classic prices.
    expect(npcBuyPrice(at(14, 13, 1))).toBe(180000);
    expect(npcBuyPrice(at(14, 14, 1))).toBe(120000);
    expect(npcBuyPrice(at(12, 15, 1))).toBe(16200);
    // Wings of Despair: 87,025,000 / 50.
    expect(npcBuyPrice(at(12, 42, 200))).toBe(1740500);
    // A small potion: 200 / 50 truncates to 4, it does not round up.
    expect(npcBuyPrice(at(14, 0, 10))).toBe(4);
  });

  it('lets a +15 excellent wing be bought: its classic price is over the 2 billion cap', () => {
    const wing = {
      group: 12,
      num: 42,
      lvl: 15,
      excellentFlags: 63,
      durability: 200,
    } as unknown as Item;
    expect(itemValue(wing, 0)).toBe(3000000000);
    expect(npcBuyPrice(wing)).toBe(60000000);
  });

  it('keeps the classic price itself unchanged', () => {
    expect(itemValue(at(14, 13, 1), 0)).toBe(9000000);
    expect(itemValue(at(12, 42, 200), 0)).toBe(87025000);
  });
});

describe('the NPC shop selling price', () => {
  it('is the classic selling price divided by 50', () => {
    expect(npcSellPrice(at(14, 13, 1))).toBe(60000);
    expect(npcSellPrice(at(14, 14, 1))).toBe(40000);
    expect(npcSellPrice(at(12, 15, 1))).toBe(5400);
    // Wings of Despair: 29,008,300 / 50, rounded to hundreds.
    expect(npcSellPrice(at(12, 42, 200))).toBe(580100);
  });

  it('always loses money on a buy-and-sell-back', () => {
    const items = [
      at(14, 13, 1),
      at(12, 42, 200),
      { group: 0, num: 0, lvl: 15, excellentFlags: 63, durability: 20 } as unknown as Item,
    ];
    for (const item of items) {
      expect(npcSellPrice(item)).toBeLessThan(npcBuyPrice(item));
    }
  });
});

describe('the NPC shop repair price', () => {
  it('is the classic repair price divided by 50', () => {
    expect(npcRepairCost(at(12, 42, 100), false)).toBe(13800);
    expect(npcRepairCost(at(12, 42, 100), true)).toBe(34500);
    expect(
      npcRepairCost(
        {
          group: 12,
          num: 42,
          lvl: 15,
          excellentFlags: 63,
          durability: 100,
        } as unknown as Item,
        false,
      ),
    ).toBe(117800);
  });

  it('sums each item on its own for a full repair, the way the server charges it', () => {
    const items = [at(12, 42, 100), at(12, 42, 100)];
    expect(npcRepairAllCost(items, false)).toBe(
      2 * npcRepairCost(at(12, 42, 100), false),
    );
  });
});
