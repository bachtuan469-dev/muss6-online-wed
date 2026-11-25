import { describe, expect, it } from 'vitest';
import { createHoldUse, HOLD_USE_MS, HOLD_USE_SLOP } from './holdUse';

/** A manual timer queue: `advance` runs everything due by then. */
function manualTimers() {
  let now = 0;
  let nextId = 1;
  const due = new Map<number, { at: number; fn: () => void }>();
  return {
    set: (fn: () => void, ms: number) => {
      const id = nextId++;
      due.set(id, { at: now + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (id: ReturnType<typeof setTimeout>) => {
      due.delete(id as unknown as number);
    },
    advance: (ms: number) => {
      now += ms;
      for (const [id, t] of [...due]) {
        if (t.at <= now) {
          due.delete(id);
          t.fn();
        }
      }
    },
  };
}

function rig() {
  const timers = manualTimers();
  let fired = 0;
  const hold = createHoldUse(() => fired++, timers);
  return { timers, hold, fired: () => fired };
}

// The touch stand-in for the grid's right click: a held touch fires the
// use action; anything else about the press must not.
describe('createHoldUse', () => {
  it('fires once for a touch press held still past the delay', () => {
    const { timers, hold, fired } = rig();
    hold.down('touch', 100, 100);
    timers.advance(HOLD_USE_MS - 1);
    expect(fired()).toBe(0);
    timers.advance(1);
    expect(fired()).toBe(1);
    timers.advance(HOLD_USE_MS * 2);
    expect(fired()).toBe(1);
  });

  it('never arms for a mouse or pen press: they have the real right click', () => {
    const { timers, hold, fired } = rig();
    hold.down('mouse', 0, 0);
    timers.advance(HOLD_USE_MS * 2);
    hold.down('pen', 0, 0);
    timers.advance(HOLD_USE_MS * 2);
    expect(fired()).toBe(0);
  });

  it('cancels when the finger wanders past the slop', () => {
    const { timers, hold, fired } = rig();
    hold.down('touch', 100, 100);
    hold.move(100 + HOLD_USE_SLOP + 1, 100);
    timers.advance(HOLD_USE_MS * 2);
    expect(fired()).toBe(0);
  });

  it('keeps counting while the finger stays within the slop', () => {
    const { timers, hold, fired } = rig();
    hold.down('touch', 100, 100);
    hold.move(100 + HOLD_USE_SLOP - 1, 100);
    timers.advance(HOLD_USE_MS);
    expect(fired()).toBe(1);
  });

  it('cancels when the press ends early', () => {
    const { timers, hold, fired } = rig();
    hold.down('touch', 100, 100);
    timers.advance(HOLD_USE_MS / 2);
    hold.end();
    timers.advance(HOLD_USE_MS * 2);
    expect(fired()).toBe(0);
  });

  it('a new press replaces the old one', () => {
    const { timers, hold, fired } = rig();
    hold.down('touch', 0, 0);
    timers.advance(HOLD_USE_MS / 2);
    hold.down('touch', 50, 50);
    timers.advance(HOLD_USE_MS / 2);
    expect(fired()).toBe(0);
    timers.advance(HOLD_USE_MS / 2);
    expect(fired()).toBe(1);
  });
});
