import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { skills, HeroSkills } from '@/modules/skills';
import { onCooldownTick } from '@/modules/skills/cooldowns';
import { skillDefinition } from '@versions/shared/skills/skillsDatabase';
import { bottomBarScreenHeight } from '@/controllers/interface/components/mu_window';
import { SkillIcon } from '../../components/skill_icon';
import { MobileButton } from './mobileButton';
import { HUD_BOTTOM_GAP, PAD_BUTTON_SIZE, SKILL_ROW_RIGHT } from './consts';
import { padSkillNumbers } from './padSkills';
import { castTouchSkill } from './castSkill';

/** One round skill button: the bar slot's icon, its greyed state and delay sweep. */
const RowSkillButton = observer(
  ({ number, onLongPress }: { number: number; onLongPress: () => void }) => {
    const usable = skills.requirementsMet(number);
    const selected = number === HeroSkills.currentSkill;
    const sweep = useRef<HTMLDivElement>(null);

    // RenderSkillDelay, as on the bar: the sweep is written straight to the
    // element on the cooldown layer's tick, never through React.
    useEffect(() => {
      const tick = () => {
        const el = sweep.current;
        if (!el) return;
        const delay = skills.cooldown(number);
        const css = delay
          ? `${Math.round(delay.fraction * PAD_BUTTON_SIZE)}px`
          : '0px';
        if (el.style.height !== css) el.style.height = css;
      };
      tick();
      return onCooldownTick(tick);
    }, [number]);

    return (
      <MobileButton
        className="mobile-pad-skill"
        title={skillDefinition(number)?.name ?? ''}
        style={{ width: PAD_BUTTON_SIZE, height: PAD_BUTTON_SIZE }}
        onTap={() => castTouchSkill(number)}
        onLongPress={onLongPress}
      >
        {pressed => (
          <>
            <div
              className="mobile-pad-skill-art"
              data-lit={pressed || selected || undefined}
            >
              <SkillIcon number={number} disabled={!usable} />
            </div>
            <div ref={sweep} className="mobile-pad-skill-delay" />
          </>
        )}
      </MobileButton>
    );
  }
);

/**
 * The learned skills as a horizontal row at the lower right (FIX24): the
 * digit slots in order, empties skipped, at most five, 44 px buttons riding
 * one gap above the bar. A tap casts; a hold opens the picker for that
 * digit slot (`onPickSkill`), so the slot can be rebound on a phone.
 */
export const SkillRow = observer(
  ({ onPickSkill }: { onPickSkill: (number: number) => void }) => {
    const numbers = padSkillNumbers(
      HeroSkills.skillHotkeys,
      HeroSkills.currentSkill
    );

    return (
      <div
        className="mobile-skill-row"
        style={{
          right: SKILL_ROW_RIGHT,
          bottom: bottomBarScreenHeight() + HUD_BOTTOM_GAP,
        }}
      >
        {numbers.map(number => (
          <RowSkillButton
            key={number}
            number={number}
            onLongPress={() => onPickSkill(number)}
          />
        ))}
      </div>
    );
  }
);
