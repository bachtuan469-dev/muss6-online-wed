import type { Item } from '@/ecs/world';
import { equipDestination, learnableSkill } from '@/controllers/item_rules';

/** The potion group, whose low numbers the bar drinks. */
const POTION_GROUP = 14;

/**
 * Whether the item is drunk from the bag (the bar's potion kinds).
 */
export function isConsumable(item: Item): boolean {
  if (item.group !== POTION_GROUP) return false;

  const n = item.num;
  return (n >= 0 && n <= 10) || (n >= 35 && n <= 40);
}

/**
 * Whether the held item is back in its square when the hold fires (FIX25
 * Viec 4): the press lifted the item, so the occupancy snapshot built
 * while it was carried has the square empty. Read the live bag, not the
 * snapshot, or the tooltip never pins.
 */
export function heldItemReturned(items: readonly (Item | null)[], slot: number, item: Item): boolean {
  return items[slot] === item;
}

/**
 * What a held item's tooltip offers as its one action (FIX24 Việc 7):
 * what the right click would have done with it. A skill orb is learned,
 * a potion is drunk, a piece of gear with a free slot is worn. Anything
 * else (a jewel, a ticket, a quest item) gets no button - the tooltip
 * still shows. `worn` is the hero's worn items, as `equipDestination`
 * reads them.
 */
export function pinnedTipAction(
  item: Item,
  worn: readonly (Item | null)[]
): 'learn' | 'use' | 'equip' | null {
  if (learnableSkill(item) !== undefined) return 'learn';
  if (isConsumable(item)) return 'use';
  if (equipDestination(item, worn) >= 0) return 'equip';
  return null;
}
