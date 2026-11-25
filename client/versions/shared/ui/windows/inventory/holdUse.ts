/**
 * The touch stand-in for the inventory grid's right click (the original's
 * use / equip button): a touch press that stays put long enough is a use.
 * The terms are the mobile controls' own (mobileButton.tsx): 400 ms held,
 * 12 px of wander allowed. Mouse and pen never arm it - they have the real
 * right click, and a held mouse press must not start drinking potions.
 */
export const HOLD_USE_MS = 400;
export const HOLD_USE_SLOP = 12;

type Timers = {
  set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (id: ReturnType<typeof setTimeout>) => void;
};

const WINDOW_TIMERS: Timers = {
  // `window.setTimeout` hands back a number; the type speaks Node's
  // `Timer`, like the test's manual queue - the cast is the seam.
  set: (fn, ms) => window.setTimeout(fn, ms) as unknown as ReturnType<typeof setTimeout>,
  clear: id => window.clearTimeout(id),
};

export type HoldUse = {
  /** A press landed on an item; only a touch press arms the timer. */
  down(pointerType: string, x: number, y: number): void;
  move(x: number, y: number): void;
  /** The press ended (up, cancel, leave): disarm without firing. */
  end(): void;
};

export function createHoldUse(onFire: () => void, timers: Timers = WINDOW_TIMERS): HoldUse {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin: { x: number; y: number } | null = null;

  const disarm = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    origin = null;
  };

  return {
    down(pointerType, x, y) {
      disarm();
      if (pointerType !== 'touch') return;
      origin = { x, y };
      timer = timers.set(() => {
        disarm();
        onFire();
      }, HOLD_USE_MS);
    },
    move(x, y) {
      if (!origin) return;
      if (Math.hypot(x - origin.x, y - origin.y) > HOLD_USE_SLOP) disarm();
    },
    end: disarm,
  };
}
