import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Events } from '@/core/eventBus/events';

vi.stubGlobal('location', { search: '', hostname: 'localhost', href: 'http://localhost/' });
const { multiplyPixels, paletteColours, spawnsFor, viewScaleForHeight } = await import('.');

const hit = { entity: {}, healthDamage: 120, shieldDamage: 0, kind: 0, isDouble: false, isTriple: false } as unknown as Events['objectDamaged'];

// The original's numbers move and run out in its logic, seen or not (CreatePoint / MovePoints).
describe('damage numbers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes none while the page is hidden: they would all rise together when it shows', () => {
    vi.stubGlobal('document', { hidden: true });
    expect(spawnsFor(hit, false)).toEqual([]);
    vi.stubGlobal('document', { hidden: false });
    expect(spawnsFor(hit, false)).toHaveLength(1);
  });

  // The numbers are fixed CSS pixels while the world is projected: on a
  // shorter view (a phone in landscape) they keep the original's proportions
  // only if they shrink with the view height. At and above the 600 px the
  // pixel constants are calibrated to, nothing changes.
  it('scales the numbers with the view height, capped at the calibrated size', () => {
    expect(viewScaleForHeight(600)).toBe(1);
    expect(viewScaleForHeight(1200)).toBe(1);
    expect(viewScaleForHeight(390)).toBeCloseTo(0.65);
    expect(viewScaleForHeight(300)).toBeCloseTo(0.5);
    expect(viewScaleForHeight(0)).toBe(1);
  });

  it('tints by multiplying the texture, so shaded pixels stay shaded', () => {
    const data = new Uint8ClampedArray([200, 100, 50, 128, 255, 255, 255, 255, 90, 90, 90, 0]);
    multiplyPixels(data, [1, 0.6, 0]);
    expect([...data]).toEqual([200, 60, 0, 128, 255, 153, 0, 255, 90, 54, 0, 0]);
  });

  it('warms a tint for every colour a spawn can carry', () => {
    const key = (colour: readonly number[]) =>
      colour.map(channel => Math.round(channel * 255)).join(',');
    const palette = new Set(paletteColours().map(key));
    const events: Events['objectDamaged'][] = [];
    for (let kind = 0; kind <= 8; kind++) {
      for (const isDouble of [false, true]) {
        for (const isTriple of [false, true]) {
          events.push({ entity: {}, healthDamage: 50, shieldDamage: 30, kind, isDouble, isTriple } as unknown as Events['objectDamaged']);
        }
      }
    }
    events.push({ entity: {}, healthDamage: 0, shieldDamage: 0, kind: 0, isDouble: false, isTriple: false } as unknown as Events['objectDamaged']);
    for (const event of events) {
      for (const onSelf of [false, true]) {
        for (const spawn of spawnsFor(event, onSelf)) {
          expect(palette.has(key(spawn.colour))).toBe(true);
        }
      }
    }
  });
});
