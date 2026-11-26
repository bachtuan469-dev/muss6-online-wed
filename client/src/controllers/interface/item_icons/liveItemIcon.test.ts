import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autorun } from 'mobx';
import { forgetLiveItemIcons, liveItemIcon, liveItemIconKey, liveItemIconState, prefetchLiveItemIcons, setLiveItemIcons, setLiveItemSpin, spinLiveItemIcon } from '.';

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// The icon slot keeps module-level state (the asked set and the landed
// pictures), so each case starts fresh: without this, cases that reuse a
// look key read the previous case's picture instead of asking again.
beforeEach(async () => {
  forgetLiveItemIcons();
  setLiveItemIcons(null);
  setLiveItemSpin(null);
  await settle();
  forgetLiveItemIcons();
});

describe('the live item icon slot', () => {
  it('asks nothing and answers null while the app has not filled it', () => {
    setLiveItemIcons(null);
    expect(liveItemIcon({ group: 14, num: 15, lvl: 0 })).toBeNull();
  });

  it('asks the source once per look and hands its URL to an observer when it lands', async () => {
    const source = vi.fn(async (item: { group: number; num: number; lvl?: number }) => `blob:${item.group}_${item.num}_${item.lvl}`);
    setLiveItemIcons(source);
    const seen: (string | null)[] = [];
    const stop = autorun(() => seen.push(liveItemIcon({ group: 12, num: 26, lvl: 0 })));
    liveItemIcon({ group: 12, num: 26, lvl: 0 });
    expect(source).toHaveBeenCalledTimes(1);
    await settle();
    expect(seen).toEqual([null, 'blob:12_26_0']);
    // Another level is another look: its tint and, for a few items, its model.
    liveItemIcon({ group: 12, num: 26, lvl: 7 });
    expect(source).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keys by everything the picture depends on, and nothing else', () => {
    expect(liveItemIconKey({ group: 7, num: 53, lvl: 9, isExcellent: true, durability: 3 } as never)).toBe('7_53_9_e');
    expect(liveItemIconKey({ group: 7, num: 53, isAncient: true })).toBe('7_53_0_a');
  });

  it('asks every look again once forgotten, and drops the pictures it had', async () => {
    const source = vi.fn(async () => 'blob:x');
    setLiveItemIcons(source);
    liveItemIcon({ group: 14, num: 13, lvl: 0 });
    await settle();
    expect(liveItemIcon({ group: 14, num: 13, lvl: 0 })).toBe('blob:x');
    forgetLiveItemIcons();
    expect(liveItemIcon({ group: 14, num: 13, lvl: 0 })).toBeNull();
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('answers null when the source fails, without asking again', async () => {
    const source = vi.fn(async () => {
      throw new Error('no model');
    });
    setLiveItemIcons(source);
    liveItemIcon({ group: 13, num: 95, lvl: 0 });
    await settle();
    expect(liveItemIcon({ group: 13, num: 95, lvl: 0 })).toBeNull();
    expect(source).toHaveBeenCalledTimes(1);
  });
});

// The icon component shows the live picture once drawn and an empty cell
// while it draws or when the item has no model, so it needs the draw's
// state, not just its URL (RenderItem3D draws every icon, ZzzInventory.cpp:9707).
describe('the live item icon state', () => {
  it('is missing while the app has not filled the slot', () => {
    setLiveItemIcons(null);
    expect(liveItemIconState({ group: 14, num: 15, lvl: 0 })).toBe('missing');
  });

  it('is pending while the picture draws and ready once it lands', async () => {
    const source = vi.fn(async () => 'blob:live');
    setLiveItemIcons(source);
    expect(liveItemIconState({ group: 12, num: 26, lvl: 0 })).toBe('pending');
    expect(source).toHaveBeenCalledTimes(1);
    await settle();
    expect(liveItemIconState({ group: 12, num: 26, lvl: 0 })).toBe('ready');
  });

  it('is missing when the source fails, and does not ask again', async () => {
    const source = vi.fn(async () => {
      throw new Error('no model');
    });
    setLiveItemIcons(source);
    expect(liveItemIconState({ group: 13, num: 95, lvl: 0 })).toBe('pending');
    await settle();
    expect(liveItemIconState({ group: 13, num: 95, lvl: 0 })).toBe('missing');
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('is missing when the source answers null, and does not ask again', async () => {
    const source = vi.fn(async () => null);
    setLiveItemIcons(source);
    liveItemIconState({ group: 13, num: 95, lvl: 0 });
    await settle();
    expect(liveItemIconState({ group: 13, num: 95, lvl: 0 })).toBe('missing');
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('draws again once forgotten', async () => {
    const source = vi.fn(async () => 'blob:x');
    setLiveItemIcons(source);
    liveItemIconState({ group: 14, num: 13, lvl: 0 });
    await settle();
    expect(liveItemIconState({ group: 14, num: 13, lvl: 0 })).toBe('ready');
    forgetLiveItemIcons();
    expect(liveItemIconState({ group: 14, num: 13, lvl: 0 })).toBe('pending');
    expect(source).toHaveBeenCalledTimes(2);
  });
});

// The warm-up starts the draw when the packet lands, ahead of the grid
// that shows the item: with no pack picture to show meanwhile, the earlier
// the shot starts, the shorter the cell stays empty.
describe('the live icon warm-up', () => {
  it('starts the draw for each item, skipping nulls', async () => {
    const source = vi.fn(async () => 'blob:live');
    setLiveItemIcons(source);
    prefetchLiveItemIcons([{ group: 12, num: 26, lvl: 0 }, null, undefined]);
    expect(source).toHaveBeenCalledTimes(1);
    await settle();
    expect(liveItemIconState({ group: 12, num: 26, lvl: 0 })).toBe('ready');
  });

  it('asks nothing while the app has not filled the slot', () => {
    setLiveItemIcons(null);
    prefetchLiveItemIcons([{ group: 12, num: 26, lvl: 0 }]);
    expect(liveItemIconState({ group: 12, num: 26, lvl: 0 })).toBe('missing');
  });

  // A picture that landed missing gets another try on the next warm-up (the
  // shop reopens, the stock arrives again): the first open timed out on a
  // cold cache, the second finds the model warm.
  it('retries a picture that landed missing on the next warm-up', async () => {
    let attempts = 0;
    const source = vi.fn(async () => (++attempts === 1 ? null : 'blob:live'));
    setLiveItemIcons(source);
    const item = { group: 12, num: 26, lvl: 0 };
    prefetchLiveItemIcons([item]);
    expect(source).toHaveBeenCalledTimes(1);
    await settle();
    expect(liveItemIconState(item)).toBe('missing');
    prefetchLiveItemIcons([item]);
    expect(source).toHaveBeenCalledTimes(2);
    await settle();
    expect(liveItemIconState(item)).toBe('ready');
    expect(liveItemIcon(item)).toBe('blob:live');
  });
});

// RenderObjectScreen turns the item under the cursor every frame (ZzzInventory.cpp:8856-8859).
describe('the live item spin slot', () => {
  const canvas = {} as HTMLCanvasElement;

  it('spins nothing while the app has not filled it', () => {
    setLiveItemSpin(null);
    expect(spinLiveItemIcon({ group: 14, num: 15, lvl: 0 }, canvas, () => {})).toBeNull();
  });

  it('hands the source the look and the canvas, and its stop back', () => {
    const stop = vi.fn();
    const source = vi.fn(() => stop);
    setLiveItemSpin(source);
    const ready = () => {};
    const got = spinLiveItemIcon({ group: 7, num: 53, lvl: 9, isExcellent: true, durability: 3 } as never, canvas, ready);
    expect(source).toHaveBeenCalledWith({ group: 7, num: 53, lvl: 9, isExcellent: true, isAncient: undefined }, canvas, ready);
    got?.();
    expect(stop).toHaveBeenCalledTimes(1);
    setLiveItemSpin(null);
  });
});
