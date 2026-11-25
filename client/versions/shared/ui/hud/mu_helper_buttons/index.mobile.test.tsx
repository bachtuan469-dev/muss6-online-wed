import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInAction } from 'mobx';
import { FIDELITY_CLASSIC, FIDELITY_DEFAULT, setFidelityChoice } from '@/controllers/fidelity';

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
const { MuHelperButtons } = await import('.');
const { Ecs } = await import('@/ecs/current');
const { MuHelper } = await import('@/modules/mu_helper');
const { Commands } = await import('@/modules/chat/commands');
const { MuWindows } = await import('@/controllers/interface/windowManager');
const { MasterSkillsWindowState, toggleMasterSkillsWindow } = await import(
  '../../windows/master_skills/windowState'
);

describe('the MU Helper HUD buttons on a phone (muHelperButtons)', () => {
  afterEach(() => {
    runInAction(() => {
      Ecs.world = null;
      MuHelper.active = false;
      Commands.windowOpen = false;
      MuWindows.setOpen('character_info', false);
      MuWindows.setOpen('inventory', false);
      MasterSkillsWindowState.open = false;
    });
    setFidelityChoice(FIDELITY_DEFAULT, {});
  });

  it('sits right of the vital bars on the top row: A, cog, D, C, I, keyboard, M, Master, ESC', () => {
    runInAction(() => {
      Ecs.world = { playerEntity: {} } as never;
    });
    const html = renderToStaticMarkup(<MuHelperButtons />);
    expect(html).toContain('mu-helper-buttons-mobile');
    // FIX25 Viec 3: 40 px squares, 2 px apart, right of the 120 px bars.
    // FIX26 Viec 5: the avatar circle pushes the row from 136 to 184.
    expect(html).toContain('position:absolute;top:0;left:184px');
    expect(html).toContain('width:40px;height:40px');
    expect(html).toContain('aria-label="Start helper"');
    expect(html).toContain('aria-label="Helper settings"');
    // FIX23: PARTY and TRADE are gone - the D window holds them. D opens the
    // command window, C the character info, I the inventory, like the keys.
    expect(html).not.toContain('aria-label="Party"');
    expect(html).not.toContain('aria-label="Trade"');
    expect(html).not.toContain('>PARTY</button>');
    expect(html).not.toContain('>TRADE</button>');
    expect(html).toContain('aria-label="Command"');
    expect(html).toContain('aria-label="Character info"');
    expect(html).toContain('aria-label="Inventory"');
    expect(html).toContain('aria-label="Keyboard"');
    expect(html).toContain('aria-label="Move list"');
    // FIX26 Viec 3: the Master tree joins the row, between M and ESC.
    expect(html).toContain('aria-label="Master skills"');
    expect(html).toContain('aria-label="Close / Menu"');
    expect(html).toContain('>A</button>');
    expect(html).toContain('<svg');
    expect(html).toContain('>D</button>');
    expect(html).toContain('>C</button>');
    expect(html).toContain('>I</button>');
    expect(html).toContain('>M</button>');
    // FIX27 Viec 2: the Master button is the letter S now, same gold
    // letters as the rest of the row, not the character sheet's art.
    expect(html).toContain('>S</button>');
    expect(html).toContain('>ESC</button>');
    expect(html).not.toContain('width:108');
    // The row order is the button order.
    const order = ['>A</button>', '>D</button>', '>C</button>', '>I</button>', '>M</button>', '>S</button>', '>ESC</button>'].map(
      text => html.indexOf(text)
    );
    expect(order.every(i => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const master = html.indexOf('aria-label="Master skills"');
    expect(master).toBeGreaterThan(html.indexOf('>M</button>'));
    expect(master).toBeLessThan(html.indexOf('>ESC</button>'));
  });

  it('keeps only the two helper squares when touch controls are off', () => {
    setFidelityChoice(FIDELITY_DEFAULT, { touchControls: false });
    runInAction(() => {
      Ecs.world = { playerEntity: {} } as never;
    });
    const html = renderToStaticMarkup(<MuHelperButtons />);
    expect(html).toContain('>A</button>');
    expect(html).toContain('aria-label="Helper settings"');
    expect(html).not.toContain('aria-label="Command"');
    // The avatar circle shares the "Character info" label, and the vital
    // bars stay when touch controls are off - so check the C square itself.
    expect(html).not.toContain('>C</button>');
    expect(html).not.toContain('aria-label="Inventory"');
    expect(html).not.toContain('aria-label="Keyboard"');
    expect(html).not.toContain('aria-label="Move list"');
    expect(html).not.toContain('aria-label="Master skills"');
    expect(html).not.toContain('aria-label="Close / Menu"');
  });

  it('marks the A square while the helper runs', () => {
    runInAction(() => {
      Ecs.world = { playerEntity: {} } as never;
      MuHelper.active = true;
    });
    const html = renderToStaticMarkup(<MuHelperButtons />);
    expect(html).toContain('aria-label="Stop helper"');
    expect(html).toContain('data-active="true"');
  });

  it('draws nothing on Classic, as on the desktop - except the vital bars', () => {
    setFidelityChoice(FIDELITY_CLASSIC, {});
    runInAction(() => {
      Ecs.world = { playerEntity: {} } as never;
    });
    const html = renderToStaticMarkup(<MuHelperButtons />);
    expect(html).not.toContain('mu-helper-buttons-mobile');
    // The bars are the original vitals, relocated - not a helper feature -
    // so they stay even when the helper buttons are switched off.
    expect(html).toContain('phone-vital-bars');
  });

  it('opens the right window on a tap and closes it on the next: D, C, I, Master', () => {
    // The buttons call these toggles directly (no DOM click in this repo's
    // SSR tests), so the round trip is the tap: open, then close again.
    // D is the command window, like the D key; C and I match their keys.
    expect(Commands.windowOpen).toBe(false);
    Commands.toggleWindow();
    expect(Commands.windowOpen).toBe(true);
    Commands.toggleWindow();
    expect(Commands.windowOpen).toBe(false);

    expect(MuWindows.isOpen('character_info')).toBe(false);
    MuWindows.setOpen('character_info', !MuWindows.isOpen('character_info'));
    expect(MuWindows.isOpen('character_info')).toBe(true);
    MuWindows.setOpen('character_info', !MuWindows.isOpen('character_info'));
    expect(MuWindows.isOpen('character_info')).toBe(false);

    expect(MuWindows.isOpen('inventory')).toBe(false);
    MuWindows.setOpen('inventory', !MuWindows.isOpen('inventory'));
    expect(MuWindows.isOpen('inventory')).toBe(true);
    MuWindows.setOpen('inventory', !MuWindows.isOpen('inventory'));
    expect(MuWindows.isOpen('inventory')).toBe(false);

    // FIX26 Viec 3: the Master button is the A key's toggle.
    expect(MasterSkillsWindowState.open).toBe(false);
    toggleMasterSkillsWindow();
    expect(MasterSkillsWindowState.open).toBe(true);
    toggleMasterSkillsWindow();
    expect(MasterSkillsWindowState.open).toBe(false);
  });
});
