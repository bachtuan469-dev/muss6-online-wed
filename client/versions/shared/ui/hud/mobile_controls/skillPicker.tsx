import { observer } from 'mobx-react-lite';
import { t } from '@/i18n';
import { bottomBarScreenHeight } from '@/controllers/interface/components/mu_window';
import { HeroSkills } from '@/modules/skills';
import { isHotbarSkill } from '@/modules/skills/skillCasting';
import { skillDefinition } from '@versions/shared/skills/skillsDatabase';
import { SkillIcon } from '../../components/skill_icon';
import {
  HUD_BOTTOM_GAP,
  PAD_BUTTON_SIZE,
  SKILL_PICKER_COLUMNS,
  SKILL_PICKER_GAP,
  SKILL_PICKER_WIDTH,
  SKILL_ROW_RIGHT,
} from './consts';

/**
 * FIX25 Viec 1: the picker a held skill button opens, listing the learned
 * skills for that digit slot. Rebuilt as a compact panel anchored above
 * the skill row (the centred row cut skills off at the edge): a grid of
 * cells, one icon above a one-line name, a tap rebinds the slot (the
 * bar's picker does the same) and closes; the clear row leaves the slot
 * empty. The backdrop or the close button dismisses it without changing
 * anything. A held button never also casts: `MobileButton` skips the
 * tap once the long press has fired.
 */
export const SkillPicker = observer(
  ({ slot, onClose }: { slot: number; onClose: () => void }) => {
    const numbers = HeroSkills.skills.map(s => s.number).filter(isHotbarSkill);

    const pick = (number: number) => {
      HeroSkills.assignSkillHotkey(slot, number);
      onClose();
    };

    return (
      <>
        <div className="mobile-skill-picker-backdrop" onPointerDown={onClose} />
        <div
          className="mobile-skill-chooser"
          role="dialog"
          aria-label={t('bottomBar.chooseSkill')}
          style={{
            right: SKILL_ROW_RIGHT,
            bottom:
              bottomBarScreenHeight() + HUD_BOTTOM_GAP + PAD_BUTTON_SIZE + SKILL_PICKER_GAP,
            width: SKILL_PICKER_WIDTH,
          }}
        >
          <div className="mobile-skill-chooser-title">
            <span>{t('bottomBar.chooseSkill')}</span>
            <button
              type="button"
              className="mobile-skill-chooser-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>
          <div
            className="mobile-skill-chooser-grid"
            style={{ gridTemplateColumns: `repeat(${SKILL_PICKER_COLUMNS}, 1fr)` }}
          >
            {numbers.map(number => (
              <button
                key={number}
                type="button"
                className="mobile-skill-chooser-cell"
                onClick={() => pick(number)}
              >
                <span className="mobile-skill-chooser-icon">
                  <SkillIcon number={number} />
                </span>
                <span className="mobile-skill-chooser-name">
                  {skillDefinition(number)?.name ?? `#${number}`}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mobile-skill-chooser-clear"
            onClick={() => pick(-1)}
          >
            {t('bottomBar.clearSlot', { key: slot })}
          </button>
        </div>
      </>
    );
  }
);
