import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import type { Item } from '@/ecs/world';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

// Skills first: they keep the app import cycle in order (versions/shared/skills/readme.md).
await import('@versions/shared/skills/skillVisuals');
const { useGridEntry } = await import('./index');
const { Bag } = await import('@/modules/inventory/state');
const { Economy } = await import('@/modules/economy/economy');
const { Hero } = await import('@/modules/hero');
const { StorageKind } = await import('@/modules/inventory/itemStorage');
const { equipDestination } = await import('@/controllers/item_rules');
const { FIRST_SLOT } = await import('./layout');

/**
 * FIX25 Viec 4: the pinned tooltip's action button runs the right click's
 * chain (`useGridEntry`), so a held item's Use / Learn / Equip really
 * does the thing instead of only showing the tooltip.
 */
describe('useGridEntry', () => {
  const slot = FIRST_SLOT;
  const entry = (item: Item) =>
    ({ slot, item }) as unknown as Parameters<typeof useGridEntry>[0];

  afterEach(() => {
    vi.restoreAllMocks();
    Bag.cancelPickedItem();
    runInAction(() => {
      Economy.tradeOpen = false;
      Economy.vaultOpen = false;
      Economy.mixOpen = false;
      Economy.myShopOpen = false;
      Hero.items[slot] = null;
    });
  });

  it('shuttles the item into the vault when a storage window is open', () => {
    const autoMove = vi.spyOn(Bag, 'autoMoveItem').mockImplementation(() => {});
    const learn = vi.spyOn(Bag, 'learnSkillItem').mockReturnValue(false);
    runInAction(() => {
      Economy.vaultOpen = true;
    });
    useGridEntry(entry({ group: 14, num: 0 } as unknown as Item));
    expect(autoMove).toHaveBeenCalledWith(StorageKind.Inventory, slot, StorageKind.Vault);
    expect(learn).not.toHaveBeenCalled();
  });

  it('learns a skill orb', () => {
    const learn = vi.spyOn(Bag, 'learnSkillItem').mockReturnValue(true);
    const consume = vi.spyOn(Bag, 'consumeItemRequest').mockImplementation(() => {});
    useGridEntry(entry({ group: 12, num: 7 } as unknown as Item));
    expect(learn).toHaveBeenCalledWith(slot);
    expect(consume).not.toHaveBeenCalled();
  });

  it('drinks a potion', () => {
    vi.spyOn(Bag, 'learnSkillItem').mockReturnValue(false);
    const consume = vi.spyOn(Bag, 'consumeItemRequest').mockImplementation(() => {});
    useGridEntry(entry({ group: 14, num: 0 } as unknown as Item));
    expect(consume).toHaveBeenCalledWith(slot);
  });

  it('wears a sword with a free hand', () => {
    const pick = vi.spyOn(Bag, 'pickInventoryItem').mockImplementation(() => {});
    const place = vi.spyOn(Bag, 'placePickedItem').mockImplementation(() => {});
    const sword = { group: 0, num: 0 } as unknown as Item;
    runInAction(() => {
      Hero.items[slot] = sword;
    });
    const destination = equipDestination(sword, Hero.items);
    expect(destination).toBeGreaterThanOrEqual(0);
    useGridEntry(entry(sword));
    expect(pick).toHaveBeenCalledWith(slot);
    expect(place).toHaveBeenCalledWith(destination);
  });
});
