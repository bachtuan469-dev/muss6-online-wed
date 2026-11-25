import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { gameVersion } from '@/version';
import type { ItemHotkeys } from '@/version/contract';

vi.stubGlobal('location', { search: '', hostname: 'localhost', href: 'http://localhost/' });
const { BottomBar } = await import('.');

const features = gameVersion.features as { itemHotkeys: ItemHotkeys };
const itemHotkeys = features.itemHotkeys;

const beltSlots = () => renderToStaticMarkup(<BottomBar />).split('consumable-item').length - 1;

describe('the bottom bar belt', () => {
  afterEach(() => {
    features.itemHotkeys = itemHotkeys;
  });

  it('draws the four Q/W/E/R slots on Season 6', () => {
    expect(beltSlots()).toBe(4);
  });

  it('draws only the slots the version has', () => {
    // 0.97d: Q, W and E.
    features.itemHotkeys = { slots: 3, bindable: false };
    expect(beltSlots()).toBe(3);
  });

  it('draws no belt for a version without one', () => {
    features.itemHotkeys = { slots: 0, bindable: false };
    expect(beltSlots()).toBe(0);
  });

  it('keeps the skill slots and window buttons on desktop', () => {
    const markup = renderToStaticMarkup(<BottomBar />);
    expect(markup.match(/class="skill-slot/g)).toHaveLength(6);
    // FIX24 Việc 9: the marketplace has no backend, so its button is
    // hidden on desktop too - the other four stay.
    expect(markup.match(/class="bar-button"/g)).toHaveLength(4);
    expect(markup).not.toContain('title="Item Shop"');
  });

  it('keeps the potion slots 20x20 on desktop', () => {
    const markup = renderToStaticMarkup(<BottomBar />);
    expect(markup.match(/width:20px;height:20px/g)).toHaveLength(4);
  });
});
