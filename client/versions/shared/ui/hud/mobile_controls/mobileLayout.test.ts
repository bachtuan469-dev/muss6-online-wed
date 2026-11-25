import { describe, expect, it } from 'vitest';
import {
  AVATAR_CIRCLE_LEFT,
  HELPER_BUTTONS_LEFT,
  HELPER_SQUARE_SIZE,
  HUD_BOTTOM_GAP,
  PAD_BUTTON_SIZE,
  POTION_CLUSTER_LEFT,
  POTION_ICON_GAP,
  POTION_ICON_SIZE,
  SKILL_PICKER_GAP,
  SKILL_PICKER_WIDTH,
  SKILL_ROW_RIGHT,
  STICK_SIZE,
  TARGET_BAR_TOP_GAP,
  VITAL_BAR_GAP,
  VITAL_BAR_HEIGHT,
  VITAL_BAR_HEIGHT_TALL,
  VITAL_BAR_WIDTH,
  VITAL_BARS_LEFT,
  skillPickerHeight,
  targetBarTop,
} from './consts';
import { CHAT_MOBILE_BOTTOM_DROP, CHAT_MOBILE_BOTTOM_GAP, mobileChatLeft, mobileChatScale } from '../chat/chatMobile';
import { CHATBOX_HEIGHT, CHATBOX_WIDTH } from '@/modules/chat/chat';

/**
 * FIX24: the touch HUD at 844x390, in screen pixels. The right stick is
 * gone (tap a monster to attack now), so the bottom row is: the move stick
 * and the potion row at the lower left, the centred chat in the middle, and
 * five skill icons at the lower right - all riding one gap above the bar.
 *
 * Worst case here is uiScale 1.3: the bottom bar is 66 px tall (top y 324)
 * and the open minimap panel ends at y 244 (top 10 + 240 x 0.75 x 1.3).
 */
describe('the touch HUD layout at 844x390 (FIX24)', () => {
  const W = 844;
  const H = 390;
  const BAR_TOP = H - 51 * 1.3;
  const MINIMAP_BOTTOM = 10 + 240 * 0.75 * 1.3;
  // Everything on the bottom row rides the same gap above the bar.
  const rowBottom = H - (51 * 1.3 + HUD_BOTTOM_GAP);

  // Move stick: left 18, bottom bar + gap, 128 disc.
  const moveStick = { left: 18, right: 18 + STICK_SIZE, top: rowBottom - STICK_SIZE, bottom: rowBottom };
  // Skill row: five 44 px buttons, 4 px apart, 12 px from the right edge.
  const rowWidth = 5 * PAD_BUTTON_SIZE + 4 * 4;
  const skillRow = {
    left: W - SKILL_ROW_RIGHT - rowWidth,
    right: W - SKILL_ROW_RIGHT,
    top: rowBottom - PAD_BUTTON_SIZE,
    bottom: rowBottom,
  };
  // Potion row: four 28 px icons, 8 px apart, right of the move stick.
  const potionRow = {
    left: POTION_CLUSTER_LEFT,
    right: POTION_CLUSTER_LEFT + 4 * POTION_ICON_SIZE + 3 * POTION_ICON_GAP,
    top: rowBottom - POTION_ICON_SIZE,
    bottom: rowBottom,
  };
  // Chat window: centred across the screen, scale capped by both
  // neighbours, dropped one potion icon so its bottom sits level with
  // the potion row (FIX25 Viec 2).
  const chatScale = mobileChatScale(1.5, W);
  const chat = {
    left: mobileChatLeft(W, chatScale),
    right: mobileChatLeft(W, chatScale) + CHATBOX_WIDTH * chatScale,
    top: rowBottom + POTION_ICON_SIZE - CHATBOX_HEIGHT * chatScale,
    bottom: rowBottom + POTION_ICON_SIZE,
  };

  it('centres the chat window across the screen', () => {
    expect(chat.left).toBe(296);
    expect(Math.abs((chat.left + chat.right) / 2 - W / 2)).toBeLessThanOrEqual(1);
  });

  it('clears the move stick: the chat window starts right of it', () => {
    expect(chat.left).toBeGreaterThanOrEqual(moveStick.right + 8);
  });

  it('clears the potion row: the chat window starts 6 px after it', () => {
    expect(chat.left).toBeGreaterThanOrEqual(potionRow.right + 6);
  });

  it('clears the skill row: the chat window ends 8 px before it', () => {
    expect(chat.right).toBeLessThanOrEqual(skillRow.left - 8);
  });

  it('sits level with the potion row, into the top of the bar', () => {
    // FIX25 Viec 2: the chat drops one potion icon, so its bottom is
    // 22 px below the bar's top edge, exactly like the potion row.
    expect(CHAT_MOBILE_BOTTOM_DROP).toBe(POTION_ICON_SIZE);
    expect(chat.bottom).toBe(BAR_TOP + POTION_ICON_SIZE - CHAT_MOBILE_BOTTOM_GAP);
  });

  it('clears the open minimap: the row starts below its lower edge', () => {
    expect(skillRow.top).toBeGreaterThanOrEqual(MINIMAP_BOTTOM);
  });

  it('clears the bottom bar: the row ends above its top edge', () => {
    expect(skillRow.bottom).toBeLessThanOrEqual(BAR_TOP);
  });

  it('keeps the row at the lower right, not in the middle of the screen', () => {
    expect(skillRow.left).toBeGreaterThan(W / 2);
    expect(skillRow.top).toBeGreaterThanOrEqual(moveStick.top);
  });

  it('rides the move stick a gap above the bottom bar', () => {
    expect(moveStick.bottom).toBe(BAR_TOP - HUD_BOTTOM_GAP);
  });

  it('rides the potion row a gap above the bottom bar, right of the stick', () => {
    expect(potionRow.bottom).toBe(BAR_TOP - HUD_BOTTOM_GAP);
    expect(potionRow.left).toBeGreaterThanOrEqual(moveStick.right + 8);
  });

  it('has no overlap between the centred chat, the potions and the row', () => {
    // The FIX23 KNOWN CONFLICT is gone: the chat shrinks to fit between
    // the potion row on the left and the five-icon row on the right.
    expect(chat.left - potionRow.right).toBeGreaterThanOrEqual(6);
    expect(skillRow.left - chat.right).toBeGreaterThanOrEqual(8);
  });
});

/**
 * FIX24 Việc 3 and 11 on the user's 932x430 phone at uiScale 1.0: the
 * chat keeps its full 1.2 scale there, so every gap is wider than at 844.
 */
describe('the touch HUD layout at 932x430 (FIX24)', () => {
  const W = 932;
  const H = 430;
  const BAR_TOP = H - 51;
  const rowBottom = H - (51 + HUD_BOTTOM_GAP);

  const moveStick = { left: 18, right: 18 + STICK_SIZE, top: rowBottom - STICK_SIZE };
  const rowWidth = 5 * PAD_BUTTON_SIZE + 4 * 4;
  const skillRow = { left: W - SKILL_ROW_RIGHT - rowWidth, right: W - SKILL_ROW_RIGHT };
  const potionRow = {
    right: POTION_CLUSTER_LEFT + 4 * POTION_ICON_SIZE + 3 * POTION_ICON_GAP,
  };
  const chatScale = mobileChatScale(1.5, W);
  const chat = {
    left: mobileChatLeft(W, chatScale),
    right: mobileChatLeft(W, chatScale) + CHATBOX_WIDTH * chatScale,
    bottom: rowBottom + POTION_ICON_SIZE,
  };

  it('keeps the chat at full scale and centred', () => {
    expect(chatScale).toBe(1.2);
    expect(chat.left).toBe(297);
    expect(Math.abs((chat.left + chat.right) / 2 - W / 2)).toBeLessThanOrEqual(1);
  });

  it('clears the potion row and the skill row, sitting level with the potions', () => {
    expect(chat.left).toBeGreaterThanOrEqual(potionRow.right + 6);
    expect(chat.right).toBeLessThanOrEqual(skillRow.left - 8);
    expect(chat.bottom).toBe(BAR_TOP + POTION_ICON_SIZE - CHAT_MOBILE_BOTTOM_GAP);
    expect(moveStick.top).toBeGreaterThanOrEqual(0);
  });
});

/**
 * FIX24 Việc 4, 10 and 11: the potion row, the vital bars and the helper
 * row at 844x390. The vital bars are reordered HP, SD, AG, MP and narrowed
 * to 120. FIX26 Việc 5: a 40 px avatar circle sits left of the bars (the
 * cluster spans 8..176), HP and MP are twice as tall as SD and AG (the
 * cluster runs y 0..72), and FIX26 Viec 3 adds a ninth 40 px helper
 * button, Master, so the row ends at 560 - the boss nameplate is covered
 * whole on the 932 px phone now too. The potion row rides the bottom now,
 * below the chat log.
 */
describe('the potion row, vital bars and helper row at 844x390 (FIX24)', () => {
  const W = 844;
  const H = 390;
  const moveStick = { right: 18 + STICK_SIZE, top: H - (51 + HUD_BOTTOM_GAP) - STICK_SIZE };
  const skillRowLeft = W - SKILL_ROW_RIGHT - (5 * PAD_BUTTON_SIZE + 4 * 4);
  const chatScale = mobileChatScale(1.5, W);
  const chatLeft = mobileChatLeft(W, chatScale);
  // The log's lower edge is the chat window's top edge at uiScale 1.4,
  // dropped one potion icon with the chat (FIX25 Viec 2).
  const logBottom = H - (51 * 1.4 + CHAT_MOBILE_BOTTOM_GAP - POTION_ICON_SIZE) - CHATBOX_HEIGHT * chatScale;

  const potionRow = {
    left: POTION_CLUSTER_LEFT,
    right: POTION_CLUSTER_LEFT + 4 * POTION_ICON_SIZE + 3 * POTION_ICON_GAP,
    top: H - (51 * 1.4 + HUD_BOTTOM_GAP) - POTION_ICON_SIZE,
    bottom: H - (51 * 1.4 + HUD_BOTTOM_GAP),
  };
  // The whole top-left cluster: avatar circle, then the bars.
  const vitalCluster = {
    left: AVATAR_CIRCLE_LEFT,
    right: VITAL_BARS_LEFT + VITAL_BAR_WIDTH,
    top: 0,
    bottom: 2 * VITAL_BAR_HEIGHT_TALL + 2 * VITAL_BAR_HEIGHT + 3 * VITAL_BAR_GAP,
  };
  const vitalBars = {
    left: VITAL_BARS_LEFT,
    right: VITAL_BARS_LEFT + VITAL_BAR_WIDTH,
    top: 0,
    bottom: vitalCluster.bottom,
  };
  // 9 buttons x 40 + 8 x 2 gap, at uiScale 1.0.
  const helperRow = {
    left: HELPER_BUTTONS_LEFT,
    right: HELPER_BUTTONS_LEFT + 9 * 40 + 8 * 2,
    top: 0,
    bottom: 40,
  };

  it('puts the potion row right of the move stick, not above it', () => {
    expect(potionRow.left).toBeGreaterThanOrEqual(moveStick.right + 8);
  });

  it('hangs the chat log left of the skill row, not over the potions', () => {
    // FIX25 Viec 2: the log drops one icon with the chat, so its lower
    // edge passes the potion row's top; the two never share x-range.
    expect(logBottom).toBeGreaterThan(potionRow.top);
    expect(potionRow.right + 6).toBeLessThanOrEqual(chatLeft);
  });

  it('clears the skill row and the middle of the screen', () => {
    expect(potionRow.right).toBeLessThanOrEqual(skillRowLeft);
    expect(potionRow.right).toBeLessThan(W / 2);
  });

  it('puts the vital bars flush at the top edge, left of the helper row', () => {
    expect(vitalCluster.top).toBe(0);
    expect(vitalCluster.left).toBe(8);
    expect(vitalCluster.right).toBe(176);
    expect(vitalCluster.bottom).toBe(72);
    expect(vitalCluster.right + 8).toBe(helperRow.left);
    expect(vitalBars.bottom).toBeLessThanOrEqual(moveStick.top);
  });

  it('puts the helper row on the same top row, right of the vital bars', () => {
    expect(helperRow.top).toBe(0);
    expect(helperRow.left).toBe(vitalBars.right + 8);
    expect(helperRow.right).toBe(560);
    // The open minimap is clear at the default scale at both widths: it
    // starts at 654 on an 844 px phone (span 10 + 180).
    expect(helperRow.right).toBeLessThan(W - 190);
  });

  it('no longer covers the boss nameplate - it sits below the row now (FIX27)', () => {
    // FIX27 Viec 3: the plate moved down under the gear row, so the row's
    // x-overlap is harmless: the plate's top clears the row's bottom at
    // every uiScale (40 px squares, one gap under), and with the helper
    // buttons off it stays at the original top.
    for (const ui of [1, 1.2, 1.4]) {
      expect(targetBarTop(ui, true)).toBeCloseTo(HELPER_SQUARE_SIZE * ui + TARGET_BAR_TOP_GAP, 10);
      expect(targetBarTop(ui, true)).toBeGreaterThan(40 * ui);
    }
    expect(targetBarTop(1, false)).toBe(0);
  });

  it('clears the open minimap at the default scale, overlaps it at 1.2 and up on 844', () => {
    // The row and the minimap both scale with uiScale. At the default
    // scale the row ends at 560 while the open minimap starts at 654 on
    // an 844 px phone. At 1.2 the row ends at 672 and the minimap starts
    // at 618, so the row covers its left 54 px; at 1.3 it covers 128 px.
    // On the 932 px phone the row clears the minimap even at 1.2
    // (672 against 706). The minimap folds to a 40 px square, which the
    // row clears even at 1.4 on 844 (784 against 794).
    expect(560).toBeLessThan(844 - (10 + 180));
    expect(560 * 1.2).toBeGreaterThan(844 - (10 + 180 * 1.2));
    expect(560 * 1.2).toBeLessThan(932 - (10 + 180 * 1.2));
    expect(560 * 1.4).toBeLessThan(844 - 10 - 40);
  });

  it('keeps the vital bars left of the centred chat', () => {
    expect(vitalBars.right).toBeLessThanOrEqual(chatLeft - 6);
  });
});

/**
 * FIX25 Viec 1: the skill picker is a compact panel above the skill row
 * now, not a centred row. Seven learned skills (the DK's list) fill two
 * grid rows of four. Worst case is uiScale 1.4 at 844x390; the 932x430
 * phone runs at uiScale 1.0.
 */
describe('the skill picker panel (FIX25)', () => {
  const SKILLS = 7;
  const height = skillPickerHeight(SKILLS);

  const panelAt = (W: number, H: number, scale: number) => {
    const bar = 51 * scale;
    const bottom = bar + HUD_BOTTOM_GAP + PAD_BUTTON_SIZE + SKILL_PICKER_GAP;
    const rowTop = H - (bar + HUD_BOTTOM_GAP) - PAD_BUTTON_SIZE;
    return {
      left: W - SKILL_ROW_RIGHT - SKILL_PICKER_WIDTH,
      right: W - SKILL_ROW_RIGHT,
      top: H - bottom - height,
      bottom: H - bottom,
      rowTop,
    };
  };

  it('fits seven skills in two grid rows', () => {
    expect(height).toBe(222);
    expect(height).toBeLessThanOrEqual(0.6 * 390);
  });

  it('stays on screen at 844x390, above the skill row and clear of the stick', () => {
    const p = panelAt(844, 390, 1.4);
    expect(p.left).toBe(532);
    expect(p.right).toBe(832);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.bottom).toBeLessThanOrEqual(p.rowTop - SKILL_PICKER_GAP);
    expect(p.left).toBeGreaterThan(18 + STICK_SIZE);
  });

  it('stays on screen at 932x430, above the skill row', () => {
    const p = panelAt(932, 430, 1.0);
    expect(p.left).toBe(620);
    expect(p.right).toBe(920);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.bottom).toBeLessThanOrEqual(p.rowTop - SKILL_PICKER_GAP);
  });

  it('scrolls instead of overflowing with many skills', () => {
    // Twenty skills need five rows, past 60vh, so the panel caps and scrolls.
    expect(skillPickerHeight(20)).toBeGreaterThan(0.6 * 390);
    expect(0.6 * 390 + (51 * 1.4 + HUD_BOTTOM_GAP + PAD_BUTTON_SIZE + SKILL_PICKER_GAP)).toBeLessThanOrEqual(390);
  });
});

/**
 * FIX27 Viec 3: the target health bar (boss nameplate) moved down below
 * the gear row on a phone: its top sits one gap under the row's bottom,
 * so the row no longer covers it. The plate is 82 wide and centred, 20
 * tall (name at 2..15, bar at 15..20).
 */
describe('the target health bar below the gear row (FIX27)', () => {
  const BAR_HEIGHT = 20;
  const BAR_WIDTH = 82;

  it('sits one gap below the gear row at every uiScale', () => {
    expect(targetBarTop(1, true)).toBe(44);
    expect(targetBarTop(1.2, true)).toBeCloseTo(52, 10);
    expect(targetBarTop(1.4, true)).toBeCloseTo(60, 10);
    expect(targetBarTop(1, false)).toBe(0);
  });

  it('clears the vitals on the left and the minimap on the right', () => {
    for (const W of [844, 932]) {
      const left = (W - BAR_WIDTH) / 2;
      const right = left + BAR_WIDTH;
      expect(left).toBeGreaterThan(VITAL_BARS_LEFT + VITAL_BAR_WIDTH);
      // The open minimap starts at W - (10 + 180 * uiScale); at 1.2 it is
      // closest, and the plate still clears it on both widths.
      expect(right).toBeLessThan(W - (10 + 180 * 1.2));
    }
  });

  it('stays on screen at 844x390 even at uiScale 1.4', () => {
    expect(targetBarTop(1.4, true) + BAR_HEIGHT).toBeLessThanOrEqual(390);
  });
});
