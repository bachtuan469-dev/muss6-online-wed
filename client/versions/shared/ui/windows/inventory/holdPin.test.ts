import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import type { Item } from '@/ecs/world';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

// Skills first: they keep the app import cycle in order (versions/shared/skills/readme.md).
await import('@versions/shared/skills/skillVisuals');
const { Hero } = await import('@/modules/hero');
const { Bag } = await import('@/modules/inventory/state');
const { heldItemReturned } = await import('./pinnedTip');
const { FIRST_SLOT } = await import('./layout');

/**
 * FIX25 Viec 4: holding an item showed nothing. The press picks the item
 * up, so the occupancy snapshot built while it is carried has the square
 * empty; the hold's fire read that snapshot and gave up before pinning.
 * The fire must read the live bag, where the cancel put the item back.
 */
describe('heldItemReturned', () => {
  const slot = FIRST_SLOT;
  const potion = { group: 14, num: 0 } as unknown as Item;

  afterEach(() => {
    Bag.cancelPickedItem();
    runInAction(() => {
      Hero.items[slot] = null;
    });
  });

  it('is true once the cancel puts the held item back in its square', () => {
    runInAction(() => {
      Hero.items[slot] = potion;
    });
    // The bag stores the observable copy: the held item is the stored
    // object, the same one the press picked up in the real flow.
    const stored = Hero.items[slot];
    if (stored === null) throw new Error('the slot should hold the potion');
    Bag.pickInventoryItem(slot);
    expect(Bag.pickedItem?.item).toBe(stored);

    // The re-render the pickup triggers rebuilds occupancy from these
    // items: the square reads empty, the view the old guard trusted.
    const staleItems = [...Hero.items];
    expect(staleItems[slot]).toBeNull();
    expect(heldItemReturned(staleItems, slot, stored)).toBe(false);

    Bag.cancelPickedItem();
    expect(Bag.pickedItem).toBeNull();
    expect(Hero.items[slot]).toBe(stored);
    expect(heldItemReturned(Hero.items, slot, stored)).toBe(true);
  });

  it('is false while the item is still carried', () => {
    runInAction(() => {
      Hero.items[slot] = potion;
    });
    const stored = Hero.items[slot];
    if (stored === null) throw new Error('the slot should hold the potion');
    Bag.pickInventoryItem(slot);
    expect(heldItemReturned(Hero.items, slot, stored)).toBe(false);
  });

  it('is false when another item sits in the square', () => {
    const other = { group: 14, num: 1 } as unknown as Item;
    runInAction(() => {
      Hero.items[slot] = other;
    });
    const stored = Hero.items[slot];
    if (stored === null) throw new Error('the slot should hold the other item');
    expect(heldItemReturned(Hero.items, slot, stored)).toBe(true);
    expect(heldItemReturned(Hero.items, slot, potion)).toBe(false);
  });
});
