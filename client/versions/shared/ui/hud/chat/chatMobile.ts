import { CHATBOX_WIDTH } from '@/modules/chat/chat';
import { POTION_ICON_SIZE } from '../mobile_controls/consts';

/**
 * FIX22: the chat window sat at the bottom-left corner, under the move
 * stick, so its tool strip and input were covered and the input looked
 * shifted. On a phone it moves right of the stick and its scale is capped
 * so it ends before the skill row.
 *
 * FIX23: the fixed left edge left it off-centre and its bottom touched the
 * bar, so the input looked squeezed against it. On a phone it is centred
 * across the screen and rides a small gap above the bar.
 *
 * FIX24: the chat, the skill row and the potion row all ride the bottom
 * now, so the scale is capped by both neighbours - the five-icon row on
 * the right and the potion row on the left.
 *
 * FIX25 Viec 2: the chat drops to the potion row's level, so its bottom
 * is the gap minus one potion icon: bar + 6 - 28.
 */

/** The gap between the chat window's bottom and the bottom bar's top. */
export const CHAT_MOBILE_BOTTOM_GAP = 6;

/** How far the chat window drops on a phone: one potion icon. */
export const CHAT_MOBILE_BOTTOM_DROP = POTION_ICON_SIZE;

/** The widest the chat window may draw on a phone. */
export const CHAT_MOBILE_SCALE_MAX = 1.2;

/**
 * The chat window's left edge on a phone: centred across the screen, whole
 * pixels, never left of the screen edge on a narrow phone.
 */
export function mobileChatLeft(viewportWidth: number, scale: number): number {
  return Math.max(0, Math.round((viewportWidth - CHATBOX_WIDTH * scale) / 2));
}

/**
 * The chat window's scale on a phone: the saved scale, capped so the
 * window ends 8 px before the skill row (row left = viewport width - 248,
 * so the window may be at most viewport width - 512 wide) and starts 6 px
 * after the potion row (it ends at x 290, so the window may be at most
 * viewport width - 592 wide).
 */
export function mobileChatScale(scale: number, viewportWidth: number): number {
  return Math.max(
    0.25,
    Math.min(
      scale,
      CHAT_MOBILE_SCALE_MAX,
      (viewportWidth - 512) / CHATBOX_WIDTH,
      (viewportWidth - 592) / CHATBOX_WIDTH
    )
  );
}
