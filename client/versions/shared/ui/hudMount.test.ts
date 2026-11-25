import { describe, expect, it, vi } from 'vitest';
import { windowsIn } from '@/controllers/interface/windows';

vi.hoisted(() => {
  (globalThis as { location?: unknown }).location = {
    search: '',
    hostname: 'localhost',
    href: 'http://localhost/',
  };
});

import './index';

describe('HUD mounts (hudMount)', () => {
  it('mounts the message box in the HUD', () => {
    const ids = windowsIn('hud').map(w => w.id);
    expect(ids).toContain('msg_window');
  });

  it('mounts the system toast in the HUD', () => {
    const ids = windowsIn('hud').map(w => w.id);
    expect(ids).toContain('system_toast');
  });
});
