import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { isOn } from '@/controllers/fidelity';
import { MuButton } from '@/controllers/interface/components/mu_button';
import { isMobileDevice } from '@/controllers/interface/mobile';
import { MsgBox } from '@/controllers/interface/msgWin';
import { MuWindows } from '@/controllers/interface/windowManager';
import { GameOptions, uiScaleFactor } from '@/controllers/settings';
import { Ecs } from '@/ecs/current';
import { Commands } from '@/modules/chat/commands';
import { MuHelper } from '@/modules/mu_helper';
import { toggleMuHelperWindow } from '@/modules/mu_helper/state';
import { openSystemMenu } from '@/modules/session/sessionExit';
import { Social } from '@/modules/social/social';
import { eventSchedule } from '@/modules/events/schedule';
import { t } from '@/i18n';
import { helperButtonsTop } from '../../windows/events/layout';
import { toggleMasterSkillsWindow } from '../../windows/master_skills/windowState';
import { HELPER_BUTTONS_LEFT, HELPER_SQUARE_SIZE } from '../mobile_controls/consts';
import { PhoneVitalBars } from './vitalBars';

const RIGHT = 10;

/** Edge of the phone squares, a thumb-sized target. */
const PHONE_SQUARE = HELPER_SQUARE_SIZE;

const phoneSquare: CSSProperties = {
  width: PHONE_SQUARE,
  height: PHONE_SQUARE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: '1px solid #8a6d2f',
  borderRadius: 4,
  background: 'rgba(0, 0, 0, 0.55)',
  color: '#FFD700',
  fontSize: 17,
  fontWeight: 'bold',
  cursor: 'pointer',
};

/** A keyboard in the button's own colour; no keyboard icon ships with the client. */
const KeyboardIcon = observer(() => (
  <svg
    width="26"
    height="18"
    viewBox="0 0 24 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="22" height="14" rx="2" />
    <g fill="currentColor" stroke="none">
      <rect x="4" y="4" width="3" height="2.4" rx="0.6" />
      <rect x="8.5" y="4" width="3" height="2.4" rx="0.6" />
      <rect x="13" y="4" width="3" height="2.4" rx="0.6" />
      <rect x="17.5" y="4" width="2.5" height="2.4" rx="0.6" />
      <rect x="4" y="8" width="3" height="2.4" rx="0.6" />
      <rect x="8.5" y="8" width="3" height="2.4" rx="0.6" />
      <rect x="13" y="8" width="3" height="2.4" rx="0.6" />
      <rect x="17.5" y="8" width="2.5" height="2.4" rx="0.6" />
      <rect x="6" y="12" width="12" height="2.2" rx="0.6" />
    </g>
  </svg>
));

/**
 * The physical Escape key's order (`keyboardInputSystem`): a message box owns
 * it, then the field that is up closes itself, then the top window, and only
 * on a clear screen does it mean the system menu.
 */
function pressEscape(): void {
  if (MsgBox.msgWin) {
    MsgBox.closeMsgWin();
    return;
  }
  if (Social.chatInputOpen) {
    Social.closeChatInput();
    return;
  }
  if (!MuWindows.closeTop()) openSystemMenu();
}

/**
 * Ours on a phone: the two wide rectangles sit mid-right, where the ATK
 * button lands on them. They shrink to two small squares in the top left
 * corner, which nothing else uses: an A that lights up green while the
 * helper runs, and a cog. Same handlers, same full labels. With touch
 * controls on, mu2003's support bar joins them in the same row: D, C, I,
 * the keyboard, M and ESC, each doing what its PC key does - D is the
 * command window (which holds trade and party, so those two buttons are
 * gone), C the character info, I the inventory.
 *
 * FIX23: the row moved off the top-left corner to the right of the vital
 * bars, on the same top row - the bars sit flush at the top edge now, and
 * the gears sit right of them. FIX25 Viec 3: the row is eight 40 px
 * squares, 2 px apart: at 844x390 it ends at 470, so it covers the whole
 * 82 px boss nameplate there (it covered 25 px at 32 px) and 45 px of it
 * on the 932 px phone (it cleared it by 19 px). The user asked for 40 px
 * knowing the row is a thumb target; the nameplate is the cost.
 * FIX26 Viec 5: the avatar circle pushes the row right to 184. FIX26
 * Viec 3: a ninth square joins it, the Master tree, between M and ESC,
 * so the row ends at 560: the nameplate is covered whole on the 932 px
 * phone now too (it was 45 px), and at 844 it already was. FIX27 Viec 2:
 * the Master square is the letter S now, same gold letters as the rest
 * of the row. FIX27 Viec 3: the nameplate moved down below this row, so
 * the cover is gone. The Master button opens the tree the way the A key
 * does - the sheet's button is class-gated per the original, the key and
 * this button are not.
 */
const PhoneHelperButtons = observer(({ ui }: { ui: number }) => {
  const active = MuHelper.active;
  const toggleLabel = t(active ? 'muHelperButtons.stop' : 'muHelperButtons.start');
  const settingsLabel = t('muHelperButtons.settings');
  const touch = isOn('touchControls');

  return (
    <div
      className="mu-helper-buttons-mobile"
      style={{
        position: 'absolute',
        top: 0,
        left: HELPER_BUTTONS_LEFT,
        display: 'flex',
        gap: 2,
        transform: `scale(${ui})`,
        transformOrigin: '0 0',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      <button
        type="button"
        title={toggleLabel}
        aria-label={toggleLabel}
        data-active={active || undefined}
        style={{
          ...phoneSquare,
          color: active ? '#7CFC7C' : '#FFD700',
          borderColor: active ? '#7CFC7C' : '#8a6d2f',
          background: active ? 'rgba(24, 68, 24, 0.72)' : 'rgba(0, 0, 0, 0.55)',
        }}
        onClick={() => MuHelper.toggleMuHelper()}
      >
        A
      </button>
      <button
        type="button"
        title={settingsLabel}
        aria-label={settingsLabel}
        style={phoneSquare}
        onClick={() => toggleMuHelperWindow()}
      >
        {/* A cog in the button's own colour; no gear icon ships with the client. */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {touch && (
        <>
          <button
            type="button"
            title={t('muHelperButtons.command')}
            aria-label={t('muHelperButtons.command')}
            style={phoneSquare}
            onClick={() => Commands.toggleWindow()}
          >
            D
          </button>
          <button
            type="button"
            title={t('muHelperButtons.characterInfo')}
            aria-label={t('muHelperButtons.characterInfo')}
            style={phoneSquare}
            onClick={() => MuWindows.setOpen('character_info', !MuWindows.isOpen('character_info'))}
          >
            C
          </button>
          <button
            type="button"
            title={t('muHelperButtons.inventory')}
            aria-label={t('muHelperButtons.inventory')}
            style={phoneSquare}
            onClick={() => MuWindows.setOpen('inventory', !MuWindows.isOpen('inventory'))}
          >
            I
          </button>
          <button
            type="button"
            title={t('muHelperButtons.keyboard')}
            aria-label={t('muHelperButtons.keyboard')}
            style={phoneSquare}
            onClick={() => Social.openChatInput()}
          >
            <KeyboardIcon />
          </button>
          <button
            type="button"
            title={t('muHelperButtons.move')}
            aria-label={t('muHelperButtons.move')}
            style={phoneSquare}
            onClick={() => MuWindows.setOpen('move_command', !MuWindows.isOpen('move_command'))}
          >
            M
          </button>
          <button
            type="button"
            title={t('muHelperButtons.master')}
            aria-label={t('muHelperButtons.master')}
            style={phoneSquare}
            onClick={() => toggleMasterSkillsWindow()}
          >
            S
          </button>
          <button
            type="button"
            title={t('muHelperButtons.escape')}
            aria-label={t('muHelperButtons.escape')}
            style={{ ...phoneSquare, fontSize: 12 }}
            onClick={() => pressEscape()}
          >
            ESC
          </button>
        </>
      )}
    </div>
  );
});

/**
 * Ours (`muHelperButtons`): the Home and End keys as buttons, top right under the minimap slot
 * and the event timers. Draws nothing on Classic.
 */
export const MuHelperButtons = observer(() => {
  if (!Ecs.world?.playerEntity) return null;

  const ui = uiScaleFactor(GameOptions.uiScale);
  if (isMobileDevice()) {
    // The vital bars sit flush at the top edge on a phone, and the helper
    // row sits right of them; both stay even when the helper buttons
    // themselves are switched off.
    return (
      <>
        {isOn('muHelperButtons') && <PhoneHelperButtons ui={ui} />}
        <PhoneVitalBars />
      </>
    );
  }
  if (!isOn('muHelperButtons')) return null;

  // The event timers' slot (`events/eventTimers.tsx`), then below their rows.
  const rows = GameOptions.eventTimers ? eventSchedule().length : 0;
  const top = helperButtonsTop(rows, ui);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        right: RIGHT,
        display: 'flex',
        gap: 4,
        transform: `scale(${ui})`,
        transformOrigin: '100% 0',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      <MuButton
        file="newui_btn_empty.OZT"
        width={108}
        height={29}
        frames={{ up: 0, active: 1, down: 2 }}
        label={t(MuHelper.active ? 'muHelperButtons.stop' : 'muHelperButtons.start')}
        labelStyle={{ fontWeight: 'bold', fontSize: 11, color: MuHelper.active ? '#7CFC7C' : '#FFD700' }}
        onClick={() => MuHelper.toggleMuHelper()}
      />
      <MuButton
        file="newui_btn_empty.OZT"
        width={108}
        height={29}
        frames={{ up: 0, active: 1, down: 2 }}
        label={t('muHelperButtons.settings')}
        labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
        onClick={() => toggleMuHelperWindow()}
      />
    </div>
  );
});
