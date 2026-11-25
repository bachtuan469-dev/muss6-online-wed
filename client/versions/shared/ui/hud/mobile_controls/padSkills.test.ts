import { describe, expect, it } from 'vitest';
import { PAD_SKILL_COUNT, padSkillNumbers } from './padSkills';

const EMPTY = new Array(10).fill(-1);

describe('padSkillNumbers (the round buttons by the ATK button)', () => {
  it('mirrors the digit slots in order, skipping the empty ones', () => {
    expect(padSkillNumbers([41, -1, 42, -1, -1, -1, -1, -1, -1, -1], -1)).toEqual([
      41, 42,
    ]);
  });

  it('carries at most PAD_SKILL_COUNT buttons', () => {
    // FIX24: the row grows from three buttons to five.
    expect(padSkillNumbers([1, 2, 3, 4, 5, 6, -1, -1, -1, -1], -1)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(PAD_SKILL_COUNT).toBe(5);
  });

  it('never shows the same skill twice', () => {
    expect(padSkillNumbers([41, 41, 42, -1, -1, -1, -1, -1, -1, -1], -1)).toEqual([
      41, 42,
    ]);
  });

  it('falls back to the current skill when no digit slot is bound', () => {
    // 41 (Twisting Slash) is a hotbar skill; the fallback is the one button a
    // fresh character gets.
    expect(padSkillNumbers(EMPTY, 41)).toEqual([41]);
  });

  it('is empty with nothing bound and no current skill', () => {
    expect(padSkillNumbers(EMPTY, -1)).toEqual([]);
  });
});
