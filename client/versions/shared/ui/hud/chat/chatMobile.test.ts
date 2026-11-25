import { describe, expect, it } from 'vitest';
import { CHATBOX_WIDTH } from '@/modules/chat/chat';
import {
  CHAT_MOBILE_BOTTOM_DROP,
  CHAT_MOBILE_BOTTOM_GAP,
  CHAT_MOBILE_SCALE_MAX,
  mobileChatLeft,
  mobileChatScale,
} from './chatMobile';

/**
 * FIX22: the chat window sat under the move stick (left 0, 281 wide at
 * scale 1.5), so its tool strip and input were covered. On a phone it moves
 * right of the stick and its scale is capped so it ends before the skill row.
 *
 * FIX23: the fixed left edge put it off-centre and its bottom touched the
 * bar, so the input looked squeezed against it. On a phone it is centred
 * across the screen and rides a small gap above the bar.
 *
 * FIX24: the chat and the skill row both ride the bottom now (Việc 3), and
 * the potion row rides it too, right of the move stick (Việc 11). The scale
 * is capped by both neighbours: it must end 8 px before the five-icon row
 * on the right and start 6 px after the potion row on the left.
 *
 * FIX25 Viec 2: the chat drops one potion icon, so its bottom sits level
 * with the potion row's bottom instead of one icon above it.
 */
describe('the chat window on a phone (FIX22)', () => {
  it('centres across the screen', () => {
    // 281 wide at 1.2 = 337; (932 - 337) / 2 = 297, whole pixels. At 844
    // the potion row caps the scale to 0.897, so the window is 252 wide
    // and starts at 296, 6 px past the potions' right edge (290).
    expect(mobileChatLeft(932, 1.2)).toBe(297);
    expect(mobileChatLeft(844, mobileChatScale(1.5, 844))).toBe(296);
    expect(mobileChatLeft(844, 1.0)).toBe(282);
  });

  it('never goes left of the screen edge on a narrow phone', () => {
    expect(mobileChatLeft(300, 1.2)).toBe(0);
  });

  it('rides a small gap above the bottom bar', () => {
    expect(CHAT_MOBILE_BOTTOM_GAP).toBe(6);
  });

  it('drops one potion icon, level with the potion row', () => {
    expect(CHAT_MOBILE_BOTTOM_DROP).toBe(28);
  });

  it('caps the scale so the window ends before the skill row', () => {
    // 281 wide at 1.2 = 337; 932 - 337 = 595, clear of the row at 684.
    expect(CHAT_MOBILE_SCALE_MAX).toBe(1.2);
    expect(mobileChatScale(1.5, 932)).toBe(1.2);
  });

  it('caps the scale so the window starts after the potion row', () => {
    // The potion row ends at x 290; the centred window must start at 296.
    // (844 - 592) / 281 = 0.897, the binding cap on an 844 px phone.
    expect(mobileChatScale(1.5, 844)).toBeCloseTo((844 - 592) / CHATBOX_WIDTH, 5);
  });

  it('leaves a small scale alone where it fits', () => {
    expect(mobileChatScale(1.0, 932)).toBe(1.0);
  });

  it('caps even a small scale on an 844 px phone so the potion row clears', () => {
    // A centred 281 px window at 844 starts at 282, 8 px inside the
    // potion row (ends 290); the cap pulls it to 0.897 so it starts at 296.
    expect(mobileChatScale(1.0, 844)).toBeCloseTo((844 - 592) / CHATBOX_WIDTH, 5);
  });

  it('shrinks further on a narrower phone so the potion row still clears', () => {
    // Potion right edge = 290; the window must start 6 px after it.
    expect(mobileChatScale(1.5, 740)).toBeCloseTo((740 - 592) / CHATBOX_WIDTH, 5);
  });
});
