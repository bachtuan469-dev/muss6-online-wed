import { describe, expect, it } from 'vitest';
import { legacyItemColours } from './itemLegacyEffects';

/**
 * The three set colours from the user's 0.97 client (dev codes), as 0-1
 * triples: Grand Soul pink RGB 255,105,180; Great Dragon / Dark Soul orange
 * RGB 255,127,0.
 */
const PINK: readonly [number, number, number] = [1.0, 0.412, 0.706];
const ORANGE: readonly [number, number, number] = [1.0, 0.498, 0.0];

function expectRgb(
  actual: readonly [number, number, number],
  expected: readonly [number, number, number],
) {
  expect(actual[0]).toBeCloseTo(expected[0], 3);
  expect(actual[1]).toBeCloseTo(expected[1], 3);
  expect(actual[2]).toBeCloseTo(expected[2], 3);
}

describe('the three 0.97 set colours', () => {
  it('Grand Soul (set 18) is pink, every piece including the shield', () => {
    for (const group of [7, 8, 9, 10, 11]) {
      expectRgb(legacyItemColours(group, 18).chrome, PINK);
      expectRgb(legacyItemColours(group, 18).ancient, PINK);
    }
    expectRgb(legacyItemColours(6, 15).chrome, PINK);
    expectRgb(legacyItemColours(6, 15).ancient, PINK);
  });

  it('Great Dragon (set 21) and Dark Soul (set 22) are orange', () => {
    for (const group of [7, 8, 9, 10, 11]) {
      expectRgb(legacyItemColours(group, 21).chrome, ORANGE);
      expectRgb(legacyItemColours(group, 21).ancient, ORANGE);
      expectRgb(legacyItemColours(group, 22).chrome, ORANGE);
      expectRgb(legacyItemColours(group, 22).ancient, ORANGE);
    }
  });

  it('the +11 chrome2 pass keeps the set colour, so +15 still reads pink / orange', () => {
    expectRgb(legacyItemColours(8, 18).chrome2 ?? [0, 0, 0], PINK);
    expectRgb(legacyItemColours(8, 21).chrome2 ?? [0, 0, 0], ORANGE);
    expectRgb(legacyItemColours(8, 22).chrome2 ?? [0, 0, 0], ORANGE);
  });

  it('other sets are untouched: set 12 stays blue-chrome with a blue ancient pass', () => {
    expectRgb(legacyItemColours(8, 12).chrome, [0.0, 0.5, 1.0]);
    expectRgb(legacyItemColours(8, 12).ancient, [0.1, 0.6, 1.0]);
  });
});
