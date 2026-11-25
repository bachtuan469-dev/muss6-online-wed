import { describe, expect, it, vi } from 'vitest';
import { potionTapDown, potionTapUp } from './potionTap';

/**
 * FIX22 Việc 7: one tap on a floating potion icon drinks, unless that same
 * tap just bound a carried potion to the slot - a tap must never bind and
 * drink at once.
 */
describe('a floating potion icon tap', () => {
  it('drinks on pointer up when nothing was picked up', () => {
    const drink = vi.fn();
    expect(potionTapDown(false, false, vi.fn())).toBe(false);
    potionTapUp(false, drink);
    expect(drink).toHaveBeenCalledTimes(1);
  });

  it('binds on pointer down and does not drink on the same tap', () => {
    const bind = vi.fn();
    const drink = vi.fn();
    const bound = potionTapDown(true, true, bind);
    expect(bind).toHaveBeenCalledTimes(1);
    expect(bound).toBe(true);
    potionTapUp(bound, drink);
    expect(drink).not.toHaveBeenCalled();
  });

  it('drinks again on the next tap after a binding tap', () => {
    const drink = vi.fn();
    const bound = potionTapDown(true, true, vi.fn());
    potionTapUp(bound, drink);
    expect(drink).not.toHaveBeenCalled();
    potionTapUp(false, drink);
    expect(drink).toHaveBeenCalledTimes(1);
  });

  it('does not bind a carried item the slot cannot take, and still drinks', () => {
    const bind = vi.fn();
    const drink = vi.fn();
    expect(potionTapDown(true, false, bind)).toBe(false);
    expect(bind).not.toHaveBeenCalled();
    potionTapUp(false, drink);
    expect(drink).toHaveBeenCalledTimes(1);
  });
});
