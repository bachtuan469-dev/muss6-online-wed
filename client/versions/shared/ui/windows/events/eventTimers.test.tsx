import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInAction } from 'mobx';
import { Ecs } from '@/ecs/current';
import type { World } from '@/ecs/world';

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
const { EventTimers } = await import('./eventTimers');

afterEach(() => {
  runInAction(() => {
    Ecs.world = null;
  });
});

describe('the event timers on a phone', () => {
  it('draws nothing: the schedule rows stay off the small screen', () => {
    runInAction(() => {
      Ecs.world = {} as unknown as World;
    });
    expect(renderToStaticMarkup(<EventTimers />)).toBe('');
  });
});
