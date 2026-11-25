import { describe, expect, it } from 'vitest';
import {
  EVENT_ROW_GAP,
  EVENT_ROW_HEIGHT,
  MINIMAP_SLOT_HEIGHT,
  MINIMAP_SLOT_TOP,
  eventTimersTop,
  helperButtonsTop,
} from './layout';

describe('the event stack tops', () => {
  it('keeps the rows in the minimap slot at interface size 1', () => {
    expect(eventTimersTop(1)).toBe(
      MINIMAP_SLOT_TOP + MINIMAP_SLOT_HEIGHT + EVENT_ROW_GAP
    );
    expect(helperButtonsTop(3, 1)).toBe(
      MINIMAP_SLOT_TOP +
        MINIMAP_SLOT_HEIGHT +
        EVENT_ROW_GAP +
        3 * EVENT_ROW_HEIGHT +
        EVENT_ROW_GAP
    );
  });

  it('scales the slot with the interface size', () => {
    expect(eventTimersTop(1.5)).toBe(
      MINIMAP_SLOT_TOP + (MINIMAP_SLOT_HEIGHT + EVENT_ROW_GAP) * 1.5
    );
    expect(helperButtonsTop(2, 2)).toBe(
      MINIMAP_SLOT_TOP +
        (MINIMAP_SLOT_HEIGHT + EVENT_ROW_GAP + 2 * EVENT_ROW_HEIGHT + EVENT_ROW_GAP) * 2
    );
  });

  it('ends the stack over the world at interface size 1, clear of the bottom bar', () => {
    // The stage is 480 tall and the bar takes its last 63: three rows plus
    // the helper buttons (29 tall) stay above that line. The corner panel
    // is drawn in its slot on a phone again (the menu cluster that owned
    // the corner is removed), so a phone keeps this same slot.
    expect(helperButtonsTop(3, 1) + 29).toBeLessThan(480 - 63);
  });
});
