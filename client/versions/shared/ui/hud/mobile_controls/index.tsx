import './style.less';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { isOn } from '@/controllers/fidelity';
import { isMobileDevice } from '@/controllers/interface/mobile';
import { HeroSkills } from '@/modules/skills';
import { Joystick } from './joystick';
import { PotionCluster } from './potionCluster';
import { SkillRow } from './skillRow';
import { SkillPicker } from './skillPicker';

/**
 * The touch HUD: the move stick at the lower left and the learned skills in
 * a row at the lower right - the `touchControls` improvement, since the
 * original is a keyboard and mouse client with no on-screen controls. The
 * aim side is gone (user decision, 2026-11-24): a tap on a monster attacks
 * it through the PC click path, so no aim layer is drawn. Drawn only on a
 * touch device with the improvement on; the desktop never sees it.
 *
 * The ATK button is gone (user decision, 2026-11-24: it auto-targeted, so
 * the aim stick replaces it) and the skill fan with it; their files stay
 * removed, `attackCluster.tsx` deleted. The floating shortcut buttons that
 * used to live here (the warp button, the menu cluster, the skill pad) stay
 * removed (user decision, 2026-11-23): their files remain in this folder,
 * unmounted. No window is out of reach without them - the gear cluster at
 * the top holds the window entries now. The potion slots moved here from
 * the bar (user decision, 2026-11-24): four icons beside the move stick, a
 * tap drinks.
 */
export const MobileControls = observer(() => {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  if (!isMobileDevice() || !isOn('touchControls')) return null;

  // A held skill button opens the picker for its digit slot; a button with
  // no slot (the current-skill fallback) takes the first free slot. All ten
  // bound leaves nowhere to put a new skill, so the picker stays shut.
  const openPickerFor = (number: number) => {
    const slot = HeroSkills.skillHotkeys.indexOf(number);
    if (slot >= 0) {
      setPickerSlot(slot);
      return;
    }
    const free = HeroSkills.skillHotkeys.indexOf(-1);
    if (free >= 0) setPickerSlot(free);
  };

  return (
    <div className="mobile-controls">
      <Joystick />
      <PotionCluster />
      <SkillRow onPickSkill={openPickerFor} />
      {pickerSlot !== null && (
        <SkillPicker slot={pickerSlot} onClose={() => setPickerSlot(null)} />
      )}
    </div>
  );
});
