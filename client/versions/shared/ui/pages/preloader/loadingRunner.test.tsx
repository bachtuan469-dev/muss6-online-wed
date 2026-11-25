import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.stubGlobal('location', { search: '', hostname: 'localhost', href: 'http://localhost/' });
const { LoadingRunner } = await import('./loadingRunner');

describe('the preloader bar, 0.97 style', () => {
  it('moves the fill by transform, not by width or left, and shows only the percent', () => {
    const html = renderToStaticMarkup(<LoadingRunner progress={0.4} done={false} />);
    expect(html).toContain('transform:scaleX(0.4)');
    expect(html).toContain('>40%</span>');
    expect(html).not.toMatch(/(width|left):40%/);
    expect(html).not.toContain('ws-runner');
    expect(html).not.toContain('ws-lightning');
  });

  it('fills all the way when done', () => {
    const html = renderToStaticMarkup(<LoadingRunner progress={0.4} done />);
    expect(html).toContain('transform:scaleX(1)');
    expect(html).toContain('>100%</span>');
  });
});
