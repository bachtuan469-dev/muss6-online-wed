import { describe, expect, it } from 'vitest';
import { STICK_DEADZONE, stickVector } from './stickMath';

const R = 64;

describe('stickVector', () => {
  it('is centred (null) while the finger is inside the deadzone', () => {
    expect(stickVector(0, 0, R)).toBeNull();
    expect(stickVector(R * (STICK_DEADZONE - 0.05), 0, R)).toBeNull();
    expect(stickVector(0, -R * 0.2, R)).toBeNull();
  });

  it('maps a full push to the unit vector in screen axes (x right, y down)', () => {
    expect(stickVector(R, 0, R)).toEqual({ x: 1, y: 0 });
    expect(stickVector(0, -R, R)).toEqual({ x: 0, y: -1 });
    expect(stickVector(-R, 0, R)).toEqual({ x: -1, y: 0 });
    expect(stickVector(0, R, R)).toEqual({ x: 0, y: 1 });
  });

  it('keeps a partial push partial, so a gentle lean reads as a gentle vector', () => {
    expect(stickVector(R / 2, 0, R)).toEqual({ x: 0.5, y: 0 });
  });

  it('clamps a push past the rim to length 1, direction kept', () => {
    const v = stickVector(R * 2, R * 2, R);
    expect(v).not.toBeNull();
    const { x, y } = v ?? { x: 0, y: 0 };
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(y).toBeCloseTo(Math.SQRT1_2);
  });

  it('refuses a base with no size', () => {
    expect(stickVector(10, 0, 0)).toBeNull();
  });
});
