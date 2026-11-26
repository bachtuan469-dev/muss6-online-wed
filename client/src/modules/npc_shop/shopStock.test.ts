import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemsDatabase } from '@versions/shared/items/itemsDatabase';
import { forgetLiveItemIcons, liveItemIconKey, setLiveItemIcons } from '@/controllers/interface/item_icons';
import { LEO_NPC_TYPE, SHOP_MAP_BY_NPC, SHOP_STOCK_BY_NPC, prefetchShopStock } from './shopStock';

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(async () => {
  forgetLiveItemIcons();
  setLiveItemIcons(null);
  await settle();
  forgetLiveItemIcons();
});

// The warm-up snapshot: a DB dump, so the test pins the numbers the slice was measured against
// (live DB 2026-11-26) and fails loudly if a regeneration changes them without a note.
describe('the shop stock snapshot', () => {
  it('covers all 27 merchants and 874 items', () => {
    const npcs = Object.keys(SHOP_STOCK_BY_NPC).map(Number);
    expect(npcs).toHaveLength(27);
    const looks = npcs.flatMap(npc => SHOP_STOCK_BY_NPC[npc]);
    expect(looks).toHaveLength(817);
  });

  it('gives Leo 70 looks over 62 model pairs, the shop the slice measured', () => {
    const leo = SHOP_STOCK_BY_NPC[LEO_NPC_TYPE];
    expect(leo).toHaveLength(70);
    expect(new Set(leo.map(item => `${item.group}_${item.num}`)).size).toBe(62);
  });

  it('keeps every look in the level range, with no ancient stock', () => {
    for (const looks of Object.values(SHOP_STOCK_BY_NPC)) {
      for (const item of looks) {
        expect(item.lvl).toBeGreaterThanOrEqual(0);
        expect(item.lvl).toBeLessThanOrEqual(15);
        expect(item.isAncient).not.toBe(true);
      }
    }
  });

  // Sixteen looks have no client item definition at all (getItem is null), so itemIconJob
  // answers null for them today and the warm-up is a no-op (no fetch, no queue slot): the
  // server sells them, the client has no def to draw. A pre-existing gap, not this slice's:
  // none of them is in Leo's stock, so his 70 looks all warm. The list is pinned so a def
  // added later (or one removed) fails loudly instead of drifting silently.
  it('names the looks with no client definition, none of them Leo’s', () => {
    const modeless: string[] = [];
    for (const looks of Object.values(SHOP_STOCK_BY_NPC)) {
      for (const item of looks) {
        const def = ItemsDatabase.getItem(item.group, item.num);
        if (!def?.szModelName.endsWith('.glb')) modeless.push(liveItemIconKey(item));
      }
    }
    expect(modeless).toEqual([
      '13_61_0',
      '13_107_0',
      '13_109_0',
      '13_110_0',
      '13_111_0',
      '13_112_0',
      '12_130_15',
      '12_131_15',
      '12_132_15',
      '12_133_15',
      '12_134_15',
      '12_135_15',
      '12_71_0',
      '12_72_0',
      '12_73_0',
      '12_74_0',
    ]);
    expect(modeless.every(key => !SHOP_STOCK_BY_NPC[LEO_NPC_TYPE].some(item => liveItemIconKey(item) === key))).toBe(true);
  });

  it('maps 26 merchants to a map, leaving only the unplaced 231 out', () => {
    expect(Object.keys(SHOP_MAP_BY_NPC)).toHaveLength(26);
    expect(SHOP_MAP_BY_NPC[231]).toBeUndefined();
    expect(SHOP_MAP_BY_NPC[LEO_NPC_TYPE]).toBe(0);
  });
});

describe('the shop stock warm-up', () => {
  it('starts the draw for each of Leo’s looks once', async () => {
    const source = vi.fn(async (item: { group: number; num: number; lvl?: number }) => 'blob:live');
    setLiveItemIcons(source);
    prefetchShopStock(LEO_NPC_TYPE);
    expect(source).toHaveBeenCalledTimes(70);
    await settle();
    expect(new Set(source.mock.calls.map(call => liveItemIconKey(call[0] as never))).size).toBe(70);
  });

  it('asks nothing for a merchant with no stock', () => {
    const source = vi.fn(async () => 'blob:live');
    setLiveItemIcons(source);
    prefetchShopStock(999);
    expect(source).not.toHaveBeenCalled();
  });
});
