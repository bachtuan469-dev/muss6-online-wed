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
const { ChatWindow } = await import('.');

/**
 * FIX22: the chat window sat under the move stick, so its tool strip and
 * input were covered and the input looked shifted. On a phone it moves right
 * of the stick and its scale is capped so it ends before the skill row.
 *
 * FIX23: the fixed left edge left it off-centre and its bottom touched the
 * bar. On a phone it is centred across the screen (844 wide, scale 1.2:
 * left 253) and rides 6 px above the bar.
 *
 * FIX24: the potion row rides the bottom too, right of the move stick, so
 * the scale is capped by both neighbours at 844: 0.897, the window 252
 * wide, left 296 - 6 px past the potions' right edge (290).
 *
 * FIX25 Viec 2: the chat drops one potion icon, so its bottom sits level
 * with the potion row: bar 51 + gap 6 - icon 28 = 29 px.
 */
describe('the chat window on mobile (FIX22)', () => {
  it('sits centred across the screen, level with the potion row', () => {
    const markup = renderToStaticMarkup(<ChatWindow />);
    expect(markup).toContain('left:296px');
    expect(markup).toContain('bottom:29px');
    expect(markup).toMatch(/scale\(0\.896[0-9]+\)/);
  });
});
