import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.stubGlobal('location', { search: '', hostname: 'localhost', href: 'http://localhost/' });
const { ItemIcon } = await import('.');
const { forgetLiveItemIcons, setLiveItemIcons } = await import('@/controllers/interface/item_icons');

const BLADE = { group: 0, num: 5, lvl: 0 };

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const resetLive = () => {
  forgetLiveItemIcons();
  setLiveItemIcons(null);
};

// RenderItem3D turns the item under the cursor (`Select`, ZzzInventory.cpp:8856-8859);
// the still picture is the live picture once drawn, an empty cell until then.
describe('the item icon', () => {
  it('holds a canvas for the turning picture while hovered, over an empty cell until it draws', () => {
    const html = renderToStaticMarkup(<ItemIcon item={BLADE} spin />);
    expect(html).toContain('<canvas');
    expect(html).not.toContain('<img');
  });

  it('is an empty cell alone otherwise, until the live picture lands', () => {
    const html = renderToStaticMarkup(<ItemIcon item={BLADE} />);
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<img');
  });
});

// RenderItem3D draws every icon from the model (ZzzInventory.cpp:9707): the
// live picture is the only picture. While it draws, or when the item has no
// model, the cell stays empty - no static picture, no missing-icon square.
describe('the still picture', () => {
  it('is an empty cell while the live one draws', () => {
    setLiveItemIcons(async () => 'blob:live-blade');
    try {
      const html = renderToStaticMarkup(<ItemIcon item={BLADE} />);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('item-icon-missing');
    } finally {
      resetLive();
    }
  });

  it('is the live picture once drawn', async () => {
    setLiveItemIcons(async () => 'blob:live-blade');
    try {
      renderToStaticMarkup(<ItemIcon item={BLADE} />);
      await settle();
      const html = renderToStaticMarkup(<ItemIcon item={BLADE} />);
      expect(html).toContain('blob:live-blade');
    } finally {
      resetLive();
    }
  });

  it('stays an empty cell when the item has no model', async () => {
    setLiveItemIcons(async () => null);
    try {
      renderToStaticMarkup(<ItemIcon item={BLADE} />);
      await settle();
      const html = renderToStaticMarkup(<ItemIcon item={BLADE} />);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('blob:');
      expect(html).not.toContain('item-icon-missing');
    } finally {
      resetLive();
    }
  });

  // Each icon shows as soon as its own live picture lands: no grid waits
  // for the rest (the batch gate is gone - user photo 2026-11-26: the shop
  // stayed empty while the queue ground through 62 cold models).
  it('shows the live picture as soon as it lands, without waiting for the grid', async () => {
    setLiveItemIcons(async () => 'blob:live-blade');
    try {
      renderToStaticMarkup(<ItemIcon item={BLADE} />);
      await settle();
      const html = renderToStaticMarkup(<ItemIcon item={BLADE} />);
      expect(html).toContain('blob:live-blade');
    } finally {
      resetLive();
    }
  });
});
