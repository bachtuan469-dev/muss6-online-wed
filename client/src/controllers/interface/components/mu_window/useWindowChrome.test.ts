import { describe, expect, it } from 'vitest';
import { centredWindowPosition } from './useWindowChrome';

/**
 * FIX24 Việc 5: on a phone the windows opened from the gear cluster and
 * the hotkeys (Command, Character Info, Inventory, Guild and the rest)
 * open in the middle of the screen, not in a corner. The anchored
 * placement has no saved x/y, so the centre is computed from the
 * viewport, the window's rendered size and the bar below.
 */
describe('centredWindowPosition', () => {
  it('centres a window in the play area above the bottom bar', () => {
    // The 190x429 inventory at fit scale 0.762 renders 145x327; on an
    // 844x390 phone above a 51 px bar that is left 350, top 6.
    const at = centredWindowPosition(844, 390, 190, 429, 0.762, 51);
    expect(at.left).toBe(350);
    expect(at.top).toBe(6);
  });

  it('centres a small window in the middle of the screen', () => {
    // The 190x120 command window at scale 1 on a 932x430 phone: the play
    // area is 932x379, so the window sits at left 371, top 130.
    const at = centredWindowPosition(932, 430, 190, 120, 1, 51);
    expect(at.left).toBe(371);
    expect(at.top).toBe(130);
  });

  it('never leaves the screen when the window is taller than the play area', () => {
    // A 429 px window at scale 1 in a 339 px play area cannot centre, so
    // it pins to the top edge instead of going negative.
    const at = centredWindowPosition(844, 390, 190, 429, 1, 51);
    expect(at.left).toBe(327);
    expect(at.top).toBe(0);
  });

  it('rounds to whole pixels', () => {
    const at = centredWindowPosition(845, 391, 191, 121, 1, 51);
    expect(Number.isInteger(at.left)).toBe(true);
    expect(Number.isInteger(at.top)).toBe(true);
  });
});
