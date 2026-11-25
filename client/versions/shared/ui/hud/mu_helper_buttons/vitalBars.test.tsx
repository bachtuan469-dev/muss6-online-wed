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
const { PhoneVitalBars } = await import('./vitalBars');
const { Hero } = await import('@/modules/hero');
const { CharacterClassNumber } = await import('@/core/types');

const saved = {
  currentHP: Hero.currentHP,
  maxHP: Hero.maxHP,
  currentMP: Hero.currentMP,
  maxMP: Hero.maxMP,
  currentSD: Hero.currentSD,
  maxSD: Hero.maxSD,
  currentAG: Hero.currentAG,
  maxAG: Hero.maxAG,
  charClass: Hero.charClass,
  level: Hero.level,
};

afterEach(() => {
  runInAction(() => {
    Hero.currentHP = saved.currentHP;
    Hero.maxHP = saved.maxHP;
    Hero.currentMP = saved.currentMP;
    Hero.maxMP = saved.maxMP;
    Hero.currentSD = saved.currentSD;
    Hero.maxSD = saved.maxSD;
    Hero.currentAG = saved.currentAG;
    Hero.maxAG = saved.maxAG;
    Hero.charClass = saved.charClass;
    Hero.level = saved.level;
  });
});

/**
 * FIX22 Việc 8: on a phone HP, MP, SD and AG leave the bottom bar and sit
 * as four short progress bars in that order, each in its orb colour, showing
 * the current number and how full it is. FIX23: they sit flush at the top
 * edge of the screen (the helper gears move right of them, same row), and
 * each bar is framed MU-style - rounded, bordered, shaded - with a bold
 * number that reads against the fill. FIX24 Việc 10: the order is HP, SD,
 * AG, MP now, and AG is the original gauge purple (#874098), not green.
 * FIX26 Việc 5: a 40 px avatar circle sits left of the bars, with the
 * hero's level pinned to its bottom edge, and HP and MP are twice as tall
 * as SD and AG (20 vs 10).
 */
describe('the top-left vital bars', () => {
  it('draws HP, SD, AG, MP in that order, in the orb colours, with number and percent', () => {
    runInAction(() => {
      Hero.currentHP = 1526;
      Hero.maxHP = 1750;
      Hero.currentMP = 2700;
      Hero.maxMP = 3000;
      Hero.currentSD = 2951;
      Hero.maxSD = 4000;
      Hero.currentAG = 400;
      Hero.maxAG = 500;
    });
    const markup = renderToStaticMarkup(<PhoneVitalBars />);
    expect(markup).toContain('phone-vital-bars');
    expect(markup).toContain('left:8px;top:0');
    expect(markup).toContain('width:120px');
    const order = ['HP 1526 (87%)', 'SD 2951 (74%)', 'AG 400 (80%)', 'MP 2700 (90%)'].map(text =>
      markup.indexOf(text)
    );
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(markup).toContain('background:#e2140c');
    expect(markup).toContain('background:#f0bd0e');
    expect(markup).toContain('background:#874098');
    expect(markup).toContain('background:#0065f1');
    expect(markup).toContain('width:87%');
    expect(markup).toContain('width:90%');
    expect(markup).toContain('width:74%');
    expect(markup).toContain('width:80%');
    expect(markup).toContain('1526');
    expect(markup).toContain('2700');
    expect(markup).toContain('2951');
    expect(markup).toContain('400');
    // MU-style frame: rounded, bordered, shaded, with a readable number.
    expect(markup).toContain('border-radius:5px');
    expect(markup).toContain('font-weight:bold');
    // FIX26 Việc 5: HP and MP are twice as tall as SD and AG.
    expect(markup.match(/;height:20px/g)?.length).toBe(2);
    expect(markup.match(/;height:10px/g)?.length).toBe(2);
  });

  it('shows the avatar circle with the hero class and the level pinned to its bottom edge', () => {
    runInAction(() => {
      Hero.charClass = CharacterClassNumber.DarkKnight;
      Hero.level = 150;
    });
    const markup = renderToStaticMarkup(<PhoneVitalBars />);
    expect(markup).toContain('phone-avatar-circle');
    expect(markup).toContain('width:40px;height:40px');
    expect(markup).toContain('border-radius:50%');
    expect(markup).toContain('>DK<');
    expect(markup).toContain('phone-avatar-level');
    expect(markup).toContain('>150<');
  });

  it('the avatar follows the hero class and the level badge follows a level-up', () => {
    runInAction(() => {
      Hero.charClass = CharacterClassNumber.DarkWizard;
      Hero.level = 113;
    });
    expect(renderToStaticMarkup(<PhoneVitalBars />)).toContain('>DW<');
    runInAction(() => {
      Hero.charClass = CharacterClassNumber.FairyElf;
      Hero.level = 114;
    });
    const markup = renderToStaticMarkup(<PhoneVitalBars />);
    expect(markup).toContain('>EF<');
    expect(markup).not.toContain('>DW<');
    expect(markup).toContain('>114<');
    expect(markup).not.toContain('>113<');
  });
});
