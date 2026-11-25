import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The picker pulls the session module, which reads `location.href` at
// load; the test environment has no window of its own, so stub it first
// and import after (the same pattern as `index.test.tsx`).
vi.stubGlobal('location', {
  href: 'http://localhost/',
  search: '',
  hostname: 'localhost',
  protocol: 'http:',
});
const { SkillPicker } = await import('./skillPicker');
const { HeroSkills } = await import('@/modules/skills');
const { bottomBarScreenHeight } = await import('@/controllers/interface/components/mu_window');
const { HUD_BOTTOM_GAP, PAD_BUTTON_SIZE, SKILL_PICKER_GAP, SKILL_ROW_RIGHT } = await import('./consts');

/**
 * FIX25 Viec 1: a held skill button opens the picker for that digit slot,
 * rebuilt as a compact panel above the skill row instead of the centred
 * row that cut skills off at the edge. It lists the learned skills as a
 * grid of cells (icon above a one-line name); a tap rebinds the slot and
 * closes, the clear row leaves the slot empty, the close button dismisses
 * it without changing anything.
 */
describe('the touch skill picker', () => {
  it('lists the learned skills as grid cells, with the title and the clear row', () => {
    HeroSkills.setSkillList([
      { index: 0, number: 41, level: 0 },
      { index: 1, number: 42, level: 0 },
      { index: 2, number: 43, level: 0 },
    ]);
    const markup = renderToStaticMarkup(<SkillPicker slot={0} onClose={() => {}} />);
    expect(markup).toContain('mobile-skill-chooser');
    expect(markup).toContain('Choose skill');
    expect(markup).toContain('mobile-skill-chooser-close');
    expect(markup).toContain('Twisting Slash');
    expect(markup).toContain('Rageful Blow');
    expect(markup).toContain('Death Stab');
    expect(markup).not.toContain('Crescent Moon Slash');
    expect(markup).toContain('Leave slot [0] empty');
    HeroSkills.setSkillList([]);
  });

  it('keeps the clear row for the slot it rebinds', () => {
    HeroSkills.setSkillList([{ index: 0, number: 41, level: 0 }]);
    const markup = renderToStaticMarkup(<SkillPicker slot={3} onClose={() => {}} />);
    expect(markup).toContain('Leave slot [3] empty');
    HeroSkills.setSkillList([]);
  });

  it('anchors above the skill row, on its right edge', () => {
    HeroSkills.setSkillList([{ index: 0, number: 41, level: 0 }]);
    const markup = renderToStaticMarkup(<SkillPicker slot={0} onClose={() => {}} />);
    const bottom = bottomBarScreenHeight() + HUD_BOTTOM_GAP + PAD_BUTTON_SIZE + SKILL_PICKER_GAP;
    expect(markup).toContain(`right:${SKILL_ROW_RIGHT}px`);
    expect(markup).toContain(`bottom:${bottom}px`);
    HeroSkills.setSkillList([]);
  });
});
