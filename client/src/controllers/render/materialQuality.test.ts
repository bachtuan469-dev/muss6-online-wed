import { describe, expect, it, vi } from 'vitest';

const options = vi.hoisted(() => ({ materialQuality: 0 }));
const webkit = vi.hoisted(() => ({ on: false }));

vi.mock('@/controllers/settings', () => ({ GameOptions: options }));
vi.mock('../lighting/lightingQuality', () => ({ lightingTier: () => null }));
vi.mock('./babylon/bitmapDecode', () => ({
  isWebKitBrowser: () => webkit.on,
}));

import { materialQuality, pbrCovers } from './materialQuality';

describe('pbrCovers', () => {
  it.each([
    [0, false, false],
    [0, true, false],
    [1, false, false],
    [1, true, true],
    [2, false, true],
    [2, true, true],
  ])('tier %i, character %s -> %s', (tier, character, expected) => {
    options.materialQuality = tier;

    expect(pbrCovers(character)).toBe(expected);
  });
});

describe('materialQuality on WebKit', () => {
  it.each([1, 2])(
    'clamps stored tier %i to Classic, whatever the saved option says',
    tier => {
      options.materialQuality = tier;
      webkit.on = true;

      expect(materialQuality()).toBe(0);
      expect(pbrCovers(true)).toBe(false);
      expect(pbrCovers(false)).toBe(false);

      webkit.on = false;
    }
  );

  it('keeps the stored tier off WebKit', () => {
    webkit.on = false;
    options.materialQuality = 2;

    expect(materialQuality()).toBe(2);
  });
});
