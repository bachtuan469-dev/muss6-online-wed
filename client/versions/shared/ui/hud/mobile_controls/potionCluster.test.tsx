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
const { PotionCluster } = await import('./potionCluster');
const { setFidelityChoice, FIDELITY_DEFAULT } = await import(
  '@/controllers/fidelity'
);

setFidelityChoice(FIDELITY_DEFAULT, {});

/**
 * FIX22 Việc 7: on a phone the four Q/W/E/R slots leave the bottom bar and
 * sit as icons right of the move stick, above the chat log: x 154..290,
 * y 108..136 at 844x390. Each is 28x28, shows what it holds, and a tap
 * drinks it (the tap rule itself lives in potionTap.test.ts).
 *
 * FIX23 Việc 4: the icons did not sit there - they stacked vertically. The
 * slot's `position: absolute` came from the `.bottom-bar .consumable-item`
 * rule, which never applies outside the bar, so the inline left/top were
 * ignored and the four 28x28 divs fell one under another. Each slot now
 * carries its own positioned frame, so the row is a row, the count sits on
 * its own icon, and an empty slot still shows its frame.
 *
 * FIX24 Việc 11: the row rides the bottom now, right of the move stick
 * (bottom 57 = the 51 px bar + the 6 px gap), same x 154..290.
 */
describe('the floating potion cluster', () => {
  it('draws the four potion slots at 28x28 beside the move stick', () => {
    const markup = renderToStaticMarkup(<PotionCluster />);
    expect(markup).toContain('position:absolute;left:154px;bottom:57px');
    expect(markup.match(/class="consumable-item/g)).toHaveLength(4);
    // One positioned frame per slot, in a row - the frame carries the
    // position now, not the slot div inside it.
    expect(markup.match(/class="potion-slot"/g)).toHaveLength(4);
    for (const style of [
      'position:absolute;left:0;top:0;width:28px;height:28px',
      'position:absolute;left:36px;top:0;width:28px;height:28px',
      'position:absolute;left:72px;top:0;width:28px;height:28px',
      'position:absolute;left:108px;top:0;width:28px;height:28px',
    ]) {
      expect(markup).toContain(style);
    }
    // The frame is visible even where the slot is empty (no icon, no count).
    expect(markup).toContain('box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35)');
  });
});
