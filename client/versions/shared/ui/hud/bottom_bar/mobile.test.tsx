import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

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
const { BottomBar } = await import('.');

/**
 * FIX18: the mobile bar is a slim strip - potions, vitals, exp. The skill
 * slots moved to the touch skill row (FIX17), so the bar no longer draws
 * them on a phone. FIX24 Việc 8: the user changed their mind again - the
 * five window buttons are hidden on mobile now (the gear cluster holds
 * their entries), so the bar is only the exp strip.
 */
describe('the bottom bar on mobile', () => {
  it('hides the skill slots: skills live in the touch row now', () => {
    expect(renderToStaticMarkup(<BottomBar />)).not.toContain('skill-slot');
  });

  it('hides the five window buttons: the gear cluster holds their entries', () => {
    expect(renderToStaticMarkup(<BottomBar />)).not.toContain('bar-button');
  });

  it('draws no potion slots on mobile: they live beside the move stick now (FIX22 Việc 7)', () => {
    expect(renderToStaticMarkup(<BottomBar />)).not.toContain('consumable-item');
  });

  it('keeps no vitals on mobile: they live in the top-left bars now (FIX22 Việc 8)', () => {
    const markup = renderToStaticMarkup(<BottomBar />);
    expect(markup).not.toContain('class="gauge"');
    expect(markup).toContain('exp-fill');
  });

  it('keeps the bar 51 px tall: the skill row and sticks keep their clearance', () => {
    expect(renderToStaticMarkup(<BottomBar />)).toContain('width:640px;height:51px');
  });

  it('paints no frame on mobile: no slab, only the exp strip (FIX23)', () => {
    const markup = renderToStaticMarkup(<BottomBar />);
    // FIX22's flat #33352e cover painted the empty middle of the bar; with
    // the frame art gone too, the bar is transparent - the exp strip floats
    // on the game, and nothing dark and empty is left. FIX24 Việc 8: the
    // five window buttons are hidden on mobile as well.
    expect(markup).not.toContain('frame-slot-cover');
    expect(markup).not.toContain('frame-piece');
    expect(markup).not.toContain('bar-button');
    expect(markup).toContain('exp-fill');
  });
});
