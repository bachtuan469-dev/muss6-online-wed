import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import { cornerPanelSpan, minimapCornerCollapsed } from './corner';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

afterEach(() => {
  runInAction(() => minimapCornerCollapsed.set(false));
});

describe('the corner minimap collapse (phone)', () => {
  it('spans the full panel while open', () => {
    expect(cornerPanelSpan()).toBe(10 + 240 * 0.75);
  });

  it('shrinks to the mini button while collapsed, so the party list and camera reset slide right', () => {
    runInAction(() => minimapCornerCollapsed.set(true));
    expect(cornerPanelSpan()).toBe(10 + 40);
  });
});
