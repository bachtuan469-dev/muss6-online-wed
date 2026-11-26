import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

import { GameOptions } from '@/controllers/settings';
import {
  itemEmissiveAt,
  itemHaloAt,
  itemLightColorAt,
  itemVisualTier,
} from './itemVisualTier';

/**
 * The +13 rung of the glow ladder, and the render level that gates it.
 * Sword of Destruction +13 has no draw rule, so the drawn level is its own.
 */
const sword13 = () => itemVisualTier({ group: 0, num: 16, lvl: 13 } as never);

describe('the +13 glow rung', () => {
  let savedLevel: number;
  let savedEffects: number;

  beforeEach(() => {
    savedLevel = GameOptions.effectLevel;
    savedEffects = GameOptions.itemEffects;
    GameOptions.effectLevel = 4;
    GameOptions.itemEffects = 2;
  });

  afterEach(() => {
    GameOptions.effectLevel = savedLevel;
    GameOptions.itemEffects = savedEffects;
  });

  it('draws +13 at the top of the ladder', () => {
    const tier = sword13();
    expect(tier.level).toBe(13);
    expect(tier.glow).toBe(4);
    expect(tier.halo).toBeCloseTo(0.62);
    expect(tier.intensity).toBeCloseTo(2.1);
    expect(tier.sparks).toBe(true);
    expect(tier.lightGain).toBeCloseTo(0.9);
    expect(tier.auraRate).toBe(52);
    expect(tier.crackleRate).toBe(12);
  });

  it('is brighter than +11: the halo peaks at 0.62, not 0.48', () => {
    const plus11 = itemVisualTier({ group: 0, num: 16, lvl: 11 } as never);
    expect(plus11.halo).toBeCloseTo(0.48);
    expect(sword13().halo).toBeGreaterThan(plus11.halo);
  });

  it('hands the GlowLayer its peak at the pulse top (Both mode)', () => {
    const tier = sword13();
    const out = itemHaloAt(tier, Math.PI / 8, { r: 0, g: 0, b: 0 });
    // Halo 0.62 at the breath peak, times the Both scale 0.65; the layer
    // multiplies by its own 0.9, so the +13 halo peaks near 0.36.
    expect(Math.max(out.r, out.g, out.b)).toBeCloseTo(0.62 * 0.65, 3);
  });

  it('is capped to +5 with no halo while the saved render level is 0', () => {
    GameOptions.effectLevel = 0;
    const tier = sword13();
    expect(tier.level).toBe(5);
    expect(tier.glow).toBe(0);
    expect(tier.halo).toBe(0);
    expect(tier.intensity).toBe(0);
    expect(tier.improvedActive).toBe(false);
  });
});

describe('excellent static violet', () => {
  let savedLevel: number;
  let savedEffects: number;

  beforeEach(() => {
    savedLevel = GameOptions.effectLevel;
    savedEffects = GameOptions.itemEffects;
    GameOptions.effectLevel = 4;
    GameOptions.itemEffects = 2;
  });

  afterEach(() => {
    GameOptions.effectLevel = savedLevel;
    GameOptions.itemEffects = savedEffects;
  });

  /** An excellent +0 sword: no level glow, so the colour is the excellent tint alone. */
  const excSword0 = () =>
    itemVisualTier({ group: 0, num: 16, lvl: 0, isExcellent: true } as never);

  it('is the same violet at every time - no hue rotation', () => {
    const tier = excSword0();
    const outs = [0, 0.25, 0.5, 0.75, 1.0].map(t =>
      itemEmissiveAt(tier, t, { r: 0, g: 0, b: 0 }),
    );
    for (const out of outs.slice(1)) {
      expect(out.r).toBeCloseTo(outs[0].r, 6);
      expect(out.g).toBeCloseTo(outs[0].g, 6);
      expect(out.b).toBeCloseTo(outs[0].b, 6);
    }
  });

  it('is violet RGB 148,0,211 at full excellent gain (Both scale 0.65)', () => {
    const out = itemEmissiveAt(excSword0(), 0.3, { r: 0, g: 0, b: 0 });
    expect(out.g).toBeCloseTo(0, 6);
    expect(out.r).toBeCloseTo((148 / 255) * 0.4 * 0.65, 3);
    expect(out.b).toBeCloseTo((211 / 255) * 0.4 * 0.65, 3);
  });

  it('the halo carries the same static violet at half gain', () => {
    const tier = excSword0();
    const outs = [0, 0.4, 0.9].map(t =>
      itemHaloAt(tier, t, { r: 0, g: 0, b: 0 }),
    );
    for (const out of outs.slice(1)) {
      expect(out.r).toBeCloseTo(outs[0].r, 6);
      expect(out.g).toBeCloseTo(outs[0].g, 6);
      expect(out.b).toBeCloseTo(outs[0].b, 6);
    }
    expect(outs[0].g).toBeCloseTo(0, 6);
    expect(outs[0].r).toBeCloseTo((148 / 255) * 0.2 * 0.65, 3);
    expect(outs[0].b).toBeCloseTo((211 / 255) * 0.2 * 0.65, 3);
  });

  it('the pooled light adds the same static violet, not a sweeping one', () => {
    const exc = itemVisualTier({ group: 0, num: 16, lvl: 9, isExcellent: true } as never);
    const plain = itemVisualTier({ group: 0, num: 16, lvl: 9 } as never);
    const diffs = [0, 0.3, 0.7].map(t => {
      const a = itemLightColorAt(exc, t, { r: 0, g: 0, b: 0 });
      const b = itemLightColorAt(plain, t, { r: 0, g: 0, b: 0 });
      return { r: a.r - b.r, g: a.g - b.g, b: a.b - b.b };
    });
    for (const d of diffs.slice(1)) {
      expect(d.r).toBeCloseTo(diffs[0].r, 6);
      expect(d.g).toBeCloseTo(diffs[0].g, 6);
      expect(d.b).toBeCloseTo(diffs[0].b, 6);
    }
    expect(diffs[0].g).toBeCloseTo(0, 6);
    expect(diffs[0].b / diffs[0].r).toBeCloseTo(211 / 148, 3);
  });
});

describe('the icon picture (shop and bag)', () => {
  let savedLevel: number;
  let savedEffects: number;

  beforeEach(() => {
    savedLevel = GameOptions.effectLevel;
    savedEffects = GameOptions.itemEffects;
    GameOptions.effectLevel = 4;
    GameOptions.itemEffects = 2;
  });

  afterEach(() => {
    GameOptions.effectLevel = savedLevel;
    GameOptions.itemEffects = savedEffects;
  });

  // The picture uses the world ladder again: the capped icon ladder
  // (FIX33-FOLLOWUP) is gone, reverted 2026-11-26 on the user's order, so a
  // +15 picture reads at the full world intensity and may flood into an
  // orange blob again, as it did before the followup.
  const peak = (t: number) => Math.PI / 8 + (t * Math.PI) / 2;

  it('+15 in the picture uses the world intensity', () => {
    const tier = itemVisualTier({ group: 0, num: 16, lvl: 15 } as never);
    const icon = itemEmissiveAt(tier, peak(0), { r: 0, g: 0, b: 0 });
    const world = itemEmissiveAt(tier, peak(0), { r: 0, g: 0, b: 0 });
    expect(Math.max(icon.r, icon.g, icon.b)).toBeCloseTo(Math.max(world.r, world.g, world.b), 6);
    expect(Math.max(icon.r, icon.g, icon.b)).toBeGreaterThan(1);
  });

  it('the level still reads: +15 is brighter than +11 in the picture', () => {
    const plus15 = itemVisualTier({ group: 0, num: 16, lvl: 15 } as never);
    const plus11 = itemVisualTier({ group: 0, num: 16, lvl: 11 } as never);
    const a = itemEmissiveAt(plus15, peak(0), { r: 0, g: 0, b: 0 });
    const b = itemEmissiveAt(plus11, peak(0), { r: 0, g: 0, b: 0 });
    expect(Math.max(a.r, a.g, a.b)).toBeGreaterThan(Math.max(b.r, b.g, b.b));
  });

  it('+0 has no level glow in the picture either', () => {
    const tier = itemVisualTier({ group: 0, num: 16, lvl: 0 } as never);
    const out = itemEmissiveAt(tier, 0.3, { r: 0, g: 0, b: 0 });
    expect(out.r).toBeCloseTo(0, 6);
    expect(out.g).toBeCloseTo(0, 6);
    expect(out.b).toBeCloseTo(0, 6);
  });

  it('the excellent violet rides at full strength in the picture', () => {
    const exc = itemVisualTier({ group: 0, num: 16, lvl: 0, isExcellent: true } as never);
    const plain = itemVisualTier({ group: 0, num: 16, lvl: 0 } as never);
    const iconDiff = diffAt(itemEmissiveAt, exc, plain, 0.3);
    const worldDiff = diffAt(itemEmissiveAt, exc, plain, 0.3);
    expect(iconDiff.g).toBeCloseTo(0, 6);
    expect(iconDiff.r).toBeCloseTo(worldDiff.r, 6);
    expect(iconDiff.b).toBeCloseTo(worldDiff.b, 6);
    expect(iconDiff.r).toBeCloseTo((148 / 255) * 0.4 * 0.65, 3);
    expect(iconDiff.b).toBeCloseTo((211 / 255) * 0.4 * 0.65, 3);
  });

  it('a true Ancient Grand Soul pulses pink in the picture, not green', () => {
    const ancient = itemVisualTier({ group: 8, num: 18, lvl: 0, isAncient: true } as never);
    const plain = itemVisualTier({ group: 8, num: 18, lvl: 0 } as never);
    for (const t of [0, 0.6, 1.3]) {
      const d = diffAt(itemEmissiveAt, ancient, plain, t);
      expect(d.g / d.r).toBeCloseTo(0.412, 2);
      expect(d.b / d.r).toBeCloseTo(0.706, 2);
    }
  });
});

/** `fn(ancient, t) - fn(plain, t)`: the tint one flag adds. */
function diffAt(
  fn: (tier: ReturnType<typeof itemVisualTier>, t: number, out: { r: number; g: number; b: number }) => { r: number; g: number; b: number },
  a: ReturnType<typeof itemVisualTier>,
  b: ReturnType<typeof itemVisualTier>,
  t: number,
) {
  const x = fn(a, t, { r: 0, g: 0, b: 0 });
  const y = fn(b, t, { r: 0, g: 0, b: 0 });
  return { r: x.r - y.r, g: x.g - y.g, b: x.b - y.b };
}

describe('the three 0.97 set colours', () => {
  let savedLevel: number;
  let savedEffects: number;

  beforeEach(() => {
    savedLevel = GameOptions.effectLevel;
    savedEffects = GameOptions.itemEffects;
    GameOptions.effectLevel = 4;
    GameOptions.itemEffects = 2;
  });

  afterEach(() => {
    GameOptions.effectLevel = savedLevel;
    GameOptions.itemEffects = savedEffects;
  });

  it('Grand Soul +15 reads pink, Great Dragon / Dark Soul +15 read orange', () => {
    const pink = itemVisualTier({ group: 8, num: 18, lvl: 15 } as never);
    expect(pink.emissive[0]).toBeCloseTo(1.0, 3);
    expect(pink.emissive[1]).toBeCloseTo(0.412, 3);
    expect(pink.emissive[2]).toBeCloseTo(0.706, 3);
    const shield = itemVisualTier({ group: 6, num: 15, lvl: 15 } as never);
    expect(shield.emissive[0]).toBeCloseTo(1.0, 3);
    expect(shield.emissive[1]).toBeCloseTo(0.412, 3);
    expect(shield.emissive[2]).toBeCloseTo(0.706, 3);
    for (const num of [21, 22]) {
      const tier = itemVisualTier({ group: 8, num, lvl: 15 } as never);
      expect(tier.emissive[0]).toBeCloseTo(1.0, 3);
      expect(tier.emissive[1]).toBeCloseTo(0.498, 3);
      expect(tier.emissive[2]).toBeCloseTo(0.0, 3);
    }
  });

  it('a true Ancient Grand Soul pulses pink, not green', () => {
    const ancient = itemVisualTier({ group: 8, num: 18, lvl: 0, isAncient: true } as never);
    const plain = itemVisualTier({ group: 8, num: 18, lvl: 0 } as never);
    for (const t of [0, 0.6, 1.3]) {
      const a = itemEmissiveAt(ancient, t, { r: 0, g: 0, b: 0 });
      const b = itemEmissiveAt(plain, t, { r: 0, g: 0, b: 0 });
      const d = { r: a.r - b.r, g: a.g - b.g, b: a.b - b.b };
      expect(d.g / d.r).toBeCloseTo(0.412, 2);
      expect(d.b / d.r).toBeCloseTo(0.706, 2);
    }
  });

  it('other Ancient sets still pulse green', () => {
    const ancient = itemVisualTier({ group: 8, num: 12, lvl: 0, isAncient: true } as never);
    const plain = itemVisualTier({ group: 8, num: 12, lvl: 0 } as never);
    const a = itemEmissiveAt(ancient, 0.2, { r: 0, g: 0, b: 0 });
    const b = itemEmissiveAt(plain, 0.2, { r: 0, g: 0, b: 0 });
    const d = { r: a.r - b.r, g: a.g - b.g, b: a.b - b.b };
    expect(d.g).toBeGreaterThan(d.r);
    expect(d.g).toBeGreaterThan(d.b);
  });
});
