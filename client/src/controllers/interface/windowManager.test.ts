import { describe, expect, it, vi } from 'vitest';
import { autorun, runInAction } from 'mobx';

const sfx = vi.hoisted(() => ({ playSfx: vi.fn(), setSfxListener: vi.fn(), clearSfxListener: vi.fn() }));
vi.mock('../sound/listener', () => sfx);

const { MuWindows } = await import('./windowManager');
const { AppState } = await import('./uiState');
const { playUiSound } = await import('@/controllers/sound/sfx');

describe('MuWindows open state', () => {
  it('starts closed and reacts to the first open of an unseen id', () => {
    const seen: boolean[] = [];
    const stop = autorun(() => seen.push(MuWindows.isOpen('test_window')));

    MuWindows.setOpen('test_window', true);
    MuWindows.setOpen('test_window', false);
    stop();

    expect(seen).toEqual([false, true, false]);
  });
});

// A window anchored above the bottom bar must fit in what is left of the
// screen, not in the whole screen: at a phone's landscape height the plain
// fit leaves the title and close button above the top edge.
describe('MuWindows.fitAboveScaleOf', () => {
  it('caps the scale so the window fits above a reserved bottom strip', async () => {
    const { getUiViewport } = await import('./components/ui_stage');
    const view = getUiViewport();
    MuWindows.register('tall_window', { width: 190, height: 700 });
    // The height term binds in this viewport and the wanted default (1.5)
    // is above it, so the plain scale is the plain fit.
    const plainFit = Math.min(
      (view.width - 24) / 190,
      (view.height - 24) / 700
    );
    expect(MuWindows.scaleOf('tall_window')).toBeCloseTo(plainFit, 3);
    // Reserving 51 px for the bottom bar leaves (height-51-12)/700.
    expect(MuWindows.fitAboveScaleOf('tall_window', 51)).toBeCloseTo(
      (view.height - 51 - 12) / 700,
      3
    );
    MuWindows.unregister('tall_window');
  });

  it('matches scaleOf when the reserve costs nothing', () => {
    MuWindows.register('small_window', { width: 100, height: 100 });
    expect(MuWindows.fitAboveScaleOf('small_window', 51)).toBe(
      MuWindows.scaleOf('small_window')
    );
    MuWindows.unregister('small_window');
  });
});

// HideAll (NewUISystem.cpp:1608), run on a map change (WSclient.cpp:2285).
describe('MuWindows.closeAll', () => {
  it('runs every stacked closer and drops every open flag', () => {
    const closed: string[] = [];
    MuWindows.setOpen('inventory', true);
    MuWindows.register('vault', undefined, () => void closed.push('vault'));
    MuWindows.register('chat', undefined, () => false);
    MuWindows.register('trade', undefined, () => void closed.push('trade'));

    MuWindows.closeAll();

    expect(closed).toEqual(['trade', 'vault']);
    expect(MuWindows.isOpen('inventory')).toBe(false);
    for (const id of ['vault', 'chat', 'trade']) MuWindows.unregister(id);
  });

  // HideAll calls each window's Hide (ClosingProcess), which plays nothing; Escape's click is the window's own.
  it('closes in silence', () => {
    MuWindows.register('quick_command', undefined, () => playUiSound('click'));
    sfx.playSfx.mockClear();
    MuWindows.closeAll();
    expect(sfx.playSfx).not.toHaveBeenCalled();
    MuWindows.closeTop();
    expect(sfx.playSfx).toHaveBeenCalled();
    MuWindows.unregister('quick_command');
  });

  it('reaches the windows the hidden interface unmounted', () => {
    const closed: string[] = [];
    MuWindows.register('vault', undefined, () => void closed.push('vault'));
    runInAction(() => (AppState.hudHidden = true));
    MuWindows.unregister('vault');
    MuWindows.closeAll();
    expect(closed).toEqual(['vault']);
    MuWindows.closeAll();
    expect(closed).toEqual(['vault']);
    runInAction(() => (AppState.hudHidden = false));
  });
});
