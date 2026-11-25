import { describe, expect, it, vi } from 'vitest';
import { ATTACK_PICK_RANGE_TILES, nearestTarget } from './attackPick';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

const at = (target: string, x: number, z: number) => ({ target, x, z });

describe('nearestTarget (the ATK button picking a monster)', () => {
  it('finds nothing in an empty field', () => {
    expect(nearestTarget(100, 100, [])).toBeNull();
  });

  it('takes the only monster in reach', () => {
    expect(nearestTarget(100, 100, [at('a', 103, 100)])).toBe('a');
  });

  it('takes the nearer of two, by tile distance like the attack system', () => {
    expect(
      nearestTarget(100, 100, [at('far', 108, 100), at('near', 101, 102)])
    ).toBe('near');
  });

  it('ignores a monster past the pick range', () => {
    expect(
      nearestTarget(100, 100, [at('a', 100 + ATTACK_PICK_RANGE_TILES + 1, 100)])
    ).toBeNull();
  });

  it('includes a monster standing exactly at the pick range', () => {
    expect(
      nearestTarget(100, 100, [at('a', 100 + ATTACK_PICK_RANGE_TILES, 100)])
    ).toBe('a');
  });

  it('keeps the first of two at the same distance', () => {
    expect(nearestTarget(100, 100, [at('a', 102, 100), at('b', 98, 100)])).toBe(
      'a'
    );
  });

  it('measures from tile corners, not float positions (a monster half a tile off is on its tile)', () => {
    expect(nearestTarget(100.9, 100.9, [at('a', 101.1, 100.1)])).toBe('a');
  });
});
