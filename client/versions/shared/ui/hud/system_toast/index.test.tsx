import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemToast } from '@/modules/chat/systemToast';

vi.mock('@/controllers/interface/mobile', () => ({ useIsMobile: () => true }));

const { SystemToastView } = await import('.');

afterEach(() => {
  SystemToast.dismiss();
});

describe('SystemToastView', () => {
  it('renders the current error line on a phone', () => {
    SystemToast.show('Not enough Zen.');
    const html = renderToStaticMarkup(<SystemToastView />);
    expect(html).toContain('Not enough Zen.');
  });

  it('renders nothing when there is no line', () => {
    const html = renderToStaticMarkup(<SystemToastView />);
    expect(html).toBe('');
  });
});
