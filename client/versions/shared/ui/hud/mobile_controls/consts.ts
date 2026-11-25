/**
 * Geometry for the mobile HUD, in screen pixels rather than the 640x480 UI
 * stage: these are thumb targets, not reproductions of the original's art, so
 * they must not shrink with the stage on a small screen.
 *
 * Both scales are whole numbers on purpose. The frames draw with
 * nearest-neighbour (`image-rendering: pixelated`), and a fractional scale
 * (the old 1.4 / 1.6) maps some sheet pixels once and their neighbours
 * twice, which is the grit players saw in the buttons. At 2 every sheet
 * pixel is an even block at any device pixel ratio. The scales belong to
 * the removed set's files, which stay in this folder unmounted.
 */

/** `IMAGE_SKILLBOX` / `IMAGE_SKILLBOX_USE`: the empty box and its lit copy. */
export const SKILLBOX_SPRITE = 'newui_skillbox.OZJ';
export const SKILLBOX_USE_SPRITE = 'newui_skillbox2.OZJ';

/** The skill box's own size on the sheet. */
export const BOX_WIDTH = 32;
export const BOX_HEIGHT = 38;

/** Boxes are drawn at 64x76 - comfortably past the ~44 px a thumb needs. */
export const SLOT_SCALE = 2;

/** The five main-frame buttons (30x41) at 60x82. */
export const MENU_SCALE = 2;

/** The stick's base and knob: a palm-sized disc, a thumb-sized knob. */
export const STICK_SIZE = 128;
export const STICK_KNOB_SIZE = 56;

/** The round skill buttons in the row at the lower right. */
export const PAD_BUTTON_SIZE = 44;

/**
 * FIX24: five 44 px buttons, 4 px apart (236 px), hug the lower right
 * corner now that the aim stick is gone: their right edge is 12 px off
 * the screen edge, and their bottom rides one gap above the bar, so at
 * 844x390 they span x 596..832, y 274..318 - clear of the open minimap
 * above (ends y 244 at uiScale 1.3) and of the bottom bar below (top
 * y 324). The chat window shrinks to fit between them and the potions.
 */
export const SKILL_ROW_RIGHT = 12;

/** The gap every bottom-row element leaves above the bottom bar. */
export const HUD_BOTTOM_GAP = 6;

/**
 * FIX24 Việc 11: the potion row rides the bottom now, right of the move
 * stick, one gap above the bar: at 844x390 it spans x 154..290, y
 * 290..318 at uiScale 1.3 - clear of the stick left, the chat log above,
 * the skill row and the chat window to the right.
 */
export const POTION_CLUSTER_LEFT = 154;
export const POTION_ICON_SIZE = 28;
export const POTION_ICON_GAP = 8;

/**
 * FIX22 Việc 8: the vital bars sit flush at the top-left corner, 10 tall
 * each, 4 apart. FIX24 Việc 10: the order is HP, SD, AG, MP now, and the
 * bars are 120 wide. FIX23: the helper gears sit right of them on the
 * same top row, so the bars no longer hang under the buttons.
 * FIX26 Việc 5: a 40 px avatar circle sits left of the bars, so the bars
 * start at 56 and the gears at 184 (eight 40 px squares, 2 px apart, end
 * at 518); HP and MP are twice as tall as SD and AG (20 vs 10), so the
 * cluster runs y 0..72.
 */
export const AVATAR_CIRCLE_LEFT = 8;
export const AVATAR_CIRCLE_SIZE = 40;
export const VITAL_BARS_LEFT = AVATAR_CIRCLE_LEFT + AVATAR_CIRCLE_SIZE + 8;
export const VITAL_BAR_WIDTH = 120;
export const VITAL_BAR_HEIGHT = 10;
export const VITAL_BAR_HEIGHT_TALL = 20;
export const VITAL_BAR_GAP = 4;

/**
 * FIX25 Viec 1: the skill picker is a compact panel above the skill row
 * now, not a centred row: 300 px wide, its right edge on the row's, its
 * bottom one gap above the row's top, so at 844x390 it spans x 532..832
 * and never covers the row, the move stick or the screen edge. Four
 * columns of cells: a 44 px icon with the name on one line under it.
 */
export const SKILL_PICKER_WIDTH = 300;
export const SKILL_PICKER_GAP = 8;
export const SKILL_PICKER_COLUMNS = 4;
/** The title row, one grid cell (44 px icon + one name line) and the clear row. */
export const SKILL_PICKER_TITLE_HEIGHT = 24;
export const SKILL_PICKER_CELL_HEIGHT = 63;
export const SKILL_PICKER_CLEAR_HEIGHT = 32;
export const SKILL_PICKER_PADDING = 8;
export const SKILL_PICKER_GRID_GAP = 8;

/** The picker's height for `count` learned skills (grid rows of 4). */
export function skillPickerHeight(count: number): number {
  const rows = Math.max(1, Math.ceil(count / SKILL_PICKER_COLUMNS));
  return (
    SKILL_PICKER_PADDING * 2 +
    SKILL_PICKER_TITLE_HEIGHT +
    SKILL_PICKER_GRID_GAP +
    rows * SKILL_PICKER_CELL_HEIGHT +
    (rows - 1) * SKILL_PICKER_GRID_GAP +
    SKILL_PICKER_GRID_GAP +
    SKILL_PICKER_CLEAR_HEIGHT
  );
}

/**
 * FIX23: the helper gears' left edge - right of the vital bars, one edge
 * gap past them, on the same top row. FIX25 Viec 3: eight 40 px squares,
 * 2 px apart, end at 470; the boss nameplate (82 wide, centred) starts
 * at 425 on a 932 px phone, so there the row covers 45 px of it. The
 * minimap, top right, is clear at the default scale at both widths.
 */
export const HELPER_BUTTONS_LEFT = VITAL_BARS_LEFT + VITAL_BAR_WIDTH + 8;

/** The helper gear row's square size, one per button. */
export const HELPER_SQUARE_SIZE = 40;

/** The gap between the gear row's bottom and the target bar's top. */
export const TARGET_BAR_TOP_GAP = 4;

/**
 * FIX27 Viec 3: the target health bar's top on a phone, one gap below
 * the gear row so the row no longer covers it. With the helper buttons
 * off there is no row, so the bar stays at the original top.
 */
export function targetBarTop(uiScale: number, helperButtonsOn: boolean): number {
  return helperButtonsOn ? HELPER_SQUARE_SIZE * uiScale + TARGET_BAR_TOP_GAP : 0;
}
