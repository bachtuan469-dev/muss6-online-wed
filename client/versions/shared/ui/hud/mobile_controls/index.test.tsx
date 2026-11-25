import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInAction } from 'mobx';

// `?mobile=1` is the touch override `controllers/interface/mobile` reads;
// the test environment has no window of its own, so stub the whole thing.
const LOCATION = {
  search: '?mobile=1',
  hostname: 'localhost',
  href: 'http://localhost/?mobile=1',
};
vi.stubGlobal('location', LOCATION);
vi.stubGlobal('window', {
  location: LOCATION,
  innerWidth: 844,
  innerHeight: 390,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: true, addEventListener: () => {} }),
});
const { MobileControls } = await import('.');
const { AppState, UIState } = await import('@/controllers/interface/uiState');
const { setFidelityChoice, FIDELITY_CLASSIC, FIDELITY_DEFAULT } = await import(
  '@/controllers/fidelity'
);

runInAction(() => {
  AppState.uiState = UIState.World;
});

afterEach(() => {
  setFidelityChoice(FIDELITY_DEFAULT, {});
});

describe('the touch HUD (mobile_controls)', () => {
  it('draws the move stick and the skill row on a touch device, no ATK button, no fixed aim stick', () => {
    const markup = renderToStaticMarkup(<MobileControls />);
    expect(markup).toContain('mobile-stick');
    expect(markup).toContain('mobile-skill-row');
    expect(markup).not.toContain('mobile-attack-stick');
    expect(markup).not.toContain('mobile-attack-button');
    expect(markup).not.toContain('ATK');
    // FIX24 Việc 1: the floating aim stick and its idle outline are gone
    // too - a tap on a monster attacks now, so no aim layer is drawn.
    expect(markup).not.toContain('aim-zone');
    expect(markup).not.toContain('mobile-aim-idle');
    // FIX24 Việc 11: the move stick rides one gap above the bottom bar.
    expect(markup).toContain('bottom:57px');
  });

  it('draws nothing on Classic: the original has no on-screen controls', () => {
    setFidelityChoice(FIDELITY_CLASSIC, {});
    expect(renderToStaticMarkup(<MobileControls />)).toBe('');
  });

  it('lays the learned skills out in a row at the lower right', async () => {
    const { HeroSkills } = await import('@/modules/skills');
    HeroSkills.setSkillList([
      { index: 0, number: 9, level: 0 },
      { index: 1, number: 3, level: 0 },
      { index: 2, number: 14, level: 0 },
      { index: 3, number: 41, level: 0 },
      { index: 4, number: 42, level: 0 },
    ]);
    const markup = renderToStaticMarkup(<MobileControls />);
    // FIX24 Việc 2: five buttons now, not three.
    expect(markup.match(/mobile-pad-skill-art/g)).toHaveLength(5);
    HeroSkills.setSkillList([]);
  });

  it('shows no skill button for a hero who knows no skill', () => {
    const markup = renderToStaticMarkup(<MobileControls />);
    expect(markup).not.toContain('mobile-pad-skill');
  });

  it('puts the skill row tight to the bottom, bottom right (FIX24)', () => {
    const markup = renderToStaticMarkup(<MobileControls />);
    expect(markup).toContain('right:12px');
    expect(markup).toContain('bottom:57px');
  });
});
