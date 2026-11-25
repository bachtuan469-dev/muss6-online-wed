import { describe, expect, it } from 'vitest';
import { BOX_HEIGHT, BOX_WIDTH, MENU_SCALE, SLOT_SCALE } from './consts';

describe('the mobile HUD scales', () => {
  it('scales the sheets by whole numbers, so nearest-neighbour stays even', () => {
    expect(Number.isInteger(MENU_SCALE)).toBe(true);
    expect(Number.isInteger(SLOT_SCALE)).toBe(true);
  });

  it('draws the skill box past the size a thumb needs', () => {
    expect(BOX_WIDTH * SLOT_SCALE).toBeGreaterThanOrEqual(44);
    expect(BOX_HEIGHT * SLOT_SCALE).toBeGreaterThanOrEqual(44);
  });
});
