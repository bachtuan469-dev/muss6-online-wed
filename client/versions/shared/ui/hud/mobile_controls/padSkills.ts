import { isHotbarSkill } from '@/modules/skills/skillCasting';

/** How many round skill buttons sit in the row at the lower right. */
export const PAD_SKILL_COUNT = 5;

/**
 * The skills the round buttons cast: the digit slots of the bottom bar in
 * order (`HeroSkills.skillHotkeys`), empties skipped, a skill never twice,
 * at most `PAD_SKILL_COUNT`. With no slot bound at all, the one button is
 * the current skill, when it is one a bar could hold - the same rule the
 * old pad's picker followed.
 */
export function padSkillNumbers(
  hotkeys: readonly number[],
  currentSkill: number
): number[] {
  const out: number[] = [];
  for (const number of hotkeys) {
    if (number < 0 || out.includes(number)) continue;
    out.push(number);
    if (out.length >= PAD_SKILL_COUNT) return out;
  }
  if (out.length === 0 && currentSkill >= 0 && isHotbarSkill(currentSkill)) {
    return [currentSkill];
  }
  return out;
}
