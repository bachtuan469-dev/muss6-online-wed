import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_TOAST_MS, SystemToast } from './systemToast';

describe('the system toast (systemToast)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    SystemToast.dismiss();
  });
  afterEach(() => {
    vi.useRealTimers();
    SystemToast.dismiss();
  });

  it('shows the line once shown', () => {
    SystemToast.show('Not enough Zen.');
    expect(SystemToast.current).toEqual({ text: 'Not enough Zen.', kind: 'error' });
  });

  it('shows nothing for empty text', () => {
    SystemToast.show('');
    expect(SystemToast.current).toBeNull();
  });

  it('dismisses itself after the timeout', () => {
    SystemToast.show('Not enough Zen.');
    vi.advanceTimersByTime(SYSTEM_TOAST_MS - 1);
    expect(SystemToast.current).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(SystemToast.current).toBeNull();
  });

  it('a new line replaces the showing one and restarts the clock', () => {
    SystemToast.show('First.');
    vi.advanceTimersByTime(SYSTEM_TOAST_MS - 1000);
    SystemToast.show('Second.');
    expect(SystemToast.current?.text).toBe('Second.');
    vi.advanceTimersByTime(SYSTEM_TOAST_MS - 1000);
    expect(SystemToast.current).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(SystemToast.current).toBeNull();
  });

  it('dismiss clears and cancels the timer', () => {
    SystemToast.show('Not enough Zen.');
    SystemToast.dismiss();
    expect(SystemToast.current).toBeNull();
    vi.advanceTimersByTime(SYSTEM_TOAST_MS * 2);
    expect(SystemToast.current).toBeNull();
  });
});
