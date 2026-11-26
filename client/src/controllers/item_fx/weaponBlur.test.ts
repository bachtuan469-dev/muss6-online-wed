import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayerAction } from '@versions/shared/objects/enum';
import { GameOptions } from '@/controllers/settings';
import { weaponBlurFor } from './weaponBlur';

/**
 * The weapon trail's colour: mapping 0 tints by the weapon's level, every
 * other mapping is white. The tint-by-glow of FIX33-GLOW2 is gone, reverted
 * 2026-11-26 on the user's order; a murderer's dark smear and the level-0
 * tint stay as the original drew them.
 */
describe('the weapon trail colour', () => {
  let savedLevel: number;
  let savedEffects: number;

  beforeEach(() => {
    savedLevel = GameOptions.effectLevel;
    savedEffects = GameOptions.itemEffects;
    GameOptions.effectLevel = 4;
    GameOptions.itemEffects = 2;
  });

  afterEach(() => {
    GameOptions.effectLevel = savedLevel;
    GameOptions.itemEffects = savedEffects;
  });

  it('leaves a glowing weapon\'s skill trail white, as the original drew it', () => {
    const row = weaponBlurFor(
      { leftHand: { group: 0, num: 16, lvl: 15 }, rightHand: null } as never,
      PlayerAction.PLAYER_ATTACK_SKILL_SWORD1,
      false
    );
    expect(row).not.toBeNull();
    expect(row!.colour).toEqual([1, 1, 1]);
    expect(row!.blend).toBe('add');
  });

  it('leaves a plain weapon\'s trail white', () => {
    const row = weaponBlurFor(
      { leftHand: { group: 0, num: 5, lvl: 0 }, rightHand: null } as never,
      PlayerAction.PLAYER_ATTACK_SKILL_SWORD1,
      false
    );
    expect(row?.colour).toEqual([1, 1, 1]);
  });

  it('keeps mapping 0 on the level colours even for a glowing weapon', () => {
    const row = weaponBlurFor(
      { leftHand: { group: 3, num: 10, lvl: 15 }, rightHand: null } as never,
      PlayerAction.PLAYER_ATTACK_SPEAR1,
      false
    );
    expect(row?.colour).toEqual([1, 0.6, 0.2]);
  });

  it('keeps the red trail red', () => {
    const row = weaponBlurFor(
      { leftHand: { group: 0, num: 13, lvl: 15 }, rightHand: null } as never,
      PlayerAction.PLAYER_ATTACK_SKILL_SWORD1,
      false
    );
    expect(row?.colour).toEqual([1, 0.2, 0.2]);
  });

  it('leaves a murderer\'s dark smear white', () => {
    const row = weaponBlurFor(
      { leftHand: { group: 0, num: 16, lvl: 15 }, rightHand: null } as never,
      PlayerAction.PLAYER_ATTACK_SKILL_SWORD1,
      true
    );
    expect(row?.colour).toEqual([1, 1, 1]);
    expect(row?.blend).toBe('subtract');
  });

  it('leaves no trail for bare hands', () => {
    expect(weaponBlurFor(undefined, PlayerAction.PLAYER_ATTACK_SKILL_SWORD1, false)).toBeNull();
  });
});
