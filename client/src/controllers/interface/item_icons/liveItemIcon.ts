import { observable, runInAction } from 'mobx';
import type { Item } from '@/ecs/world';

/**
 * The bag icon drawn from the item's model, as the original draws every icon (`RenderItem3D`,
 * ZzzInventory.cpp:9707). The interface does not reach the scene: the app fills this slot at boot
 * with what draws it.
 */
export type LiveItemIconSource = (item: Item) => Promise<string | null>;

let source: LiveItemIconSource | null = null;

/** Look key -> URL, or null when it cannot be drawn. Absent while not asked or still drawing. */
const urls = observable.map<string, string | null>({}, { deep: false });
const asked = new Set<string>();

export function setLiveItemIcons(next: LiveItemIconSource | null): void {
  source = next;
}

/** Everything the picture depends on: the model and pose follow group, number and level; the tint level and options too. */
export function liveItemIconKey(item: Item): string {
  return `${item.group}_${item.num}_${item.lvl ?? 0}${item.isExcellent ? '_e' : ''}${item.isAncient ? '_a' : ''}`;
}

/**
 * Turns the item's model on `canvas` every frame until the returned stop is called, `ready` on its
 * first picture (the item under the cursor, `Select` in RenderObjectScreen, ZzzInventory.cpp:8856-8859).
 */
export type LiveItemSpinSource = (item: Item, canvas: HTMLCanvasElement, ready: () => void) => () => void;

let spinSource: LiveItemSpinSource | null = null;

export function setLiveItemSpin(next: LiveItemSpinSource | null): void {
  spinSource = next;
}

/** Spins the item's look on `canvas`; null while the app has not filled the slot. */
export function spinLiveItemIcon(item: Item, canvas: HTMLCanvasElement, ready: () => void): (() => void) | null {
  if (!spinSource) return null;
  const { group, num, lvl, isExcellent, isAncient } = item;
  return spinSource({ group, num, lvl, isExcellent, isAncient }, canvas, ready);
}

/** Drops every picture: the next read of each look asks for it again (a changed item-effects option). */
export function forgetLiveItemIcons(): void {
  asked.clear();
  runInAction(() => urls.clear());
}

/**
 * Start the draw for these items now, ahead of the grid that shows them:
 * with no static picture to show meanwhile, the earlier a shot starts, the
 * shorter its cell stays empty. Nulls are skipped.
 */
export function prefetchLiveItemIcons(items: Iterable<Item | null | undefined>): void {
  for (const item of items) {
    if (!item) continue;
    // A picture that landed missing gets another try on the next warm-up (the
    // render path never retries, so this is the only retry): the first open
    // timed out on a cold cache, the next finds the model warm.
    const key = liveItemIconKey(item);
    if (urls.has(key) && urls.get(key) === null) asked.delete(key);
    liveItemIcon(item);
  }
}

/** The item's live icon once drawn, else null; the first read asks for it. Observable. */
export function liveItemIcon(item: Item): string | null {
  const key = liveItemIconKey(item);
  if (source && !asked.has(key)) {
    asked.add(key);
    const land = (url: string | null) => runInAction(() => urls.set(key, url));
    // The look's own fields only: an observer reading the rest would re-render on a durability tick.
    const { group, num, lvl, isExcellent, isAncient } = item;
    source({ group, num, lvl, isExcellent, isAncient }).then(land, () => land(null));
  }
  return urls.get(key) ?? null;
}

export type LiveItemIconState = 'pending' | 'ready' | 'missing';

/** The draw's state: the icon shows the live picture once drawn, an empty cell while it draws or when the item has no model. */
export function liveItemIconState(item: Item): LiveItemIconState {
  if (!source) return 'missing';
  const key = liveItemIconKey(item);
  if (urls.has(key)) return urls.get(key) ? 'ready' : 'missing';
  liveItemIcon(item);
  return 'pending';
}

