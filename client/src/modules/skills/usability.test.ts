import { describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import { CharacterClassNumber } from '../../core/types';
import { InventoryConstants } from '../../core/inventoryConstants';
import type { Item } from '../../ecs/world';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

const { ItemsDatabase } = await import('@versions/shared/items/itemsDatabase');
const { skillUsability, weaponSkillEquipped } = await import('./usability');
const { HeroSkills } = await import('./state');
const { Hero } = await import('../hero');
const { startSkillCooldown, cooldownsLayer } = await import('./cooldowns');
const { SKILL_DELAY_MS } = await import('@/controllers/combat');

const TRIPLE_SHOT = 24;
const STRENGTHENER = 414;
const MASTERY = 418;

/** A bow that carries Triple Shot, with its skill, in the left hand (or nothing there). */
function holdBow(held: boolean): void {
  const bow = ItemsDatabase.all().find(i => i.Group === 4 && i.Skill === TRIPLE_SHOT);
  if (!bow) throw new Error('no Triple Shot bow in the item table');
  runInAction(() => {
    Hero.items[InventoryConstants.LeftHandSlot] = held ? ({ group: 4, num: bow.Index, hasSkill: true } as unknown as Item) : null;
  });
}

// IsNonWeaponSkillOrIsSkillEquipped checks the weapon of the master skill's base (CSItemOption.cpp:602-640).
describe('a master skill of a weapon skill', () => {
  it('needs the weapon that carries its base skill, the Mastery as the Strengthener', () => {
    for (const skill of [TRIPLE_SHOT, STRENGTHENER, MASTERY]) {
      holdBow(false);
      expect(weaponSkillEquipped(skill)).toBe(false);
      holdBow(true);
      expect(weaponSkillEquipped(skill)).toBe(true);
    }
  });

  it('is cast only with that weapon in hand (NewUIMainFrameWindow.cpp:2389)', () => {
    runInAction(() => {
      Hero.charClass = CharacterClassNumber.HighElf;
      Hero.level = 400;
    });
    HeroSkills.setSkillList([{ index: 0, number: STRENGTHENER, level: 0 }]);
    holdBow(false);
    expect(skillUsability(STRENGTHENER).blocks).toContain('weapon');
    holdBow(true);
    expect(skillUsability(STRENGTHENER).blocks).not.toContain('weapon');
  });
});

// The level rule is gone (user decision, 2026-11-24): a skill is bright and
// usable at any hero level. Only class / energy / weapon still grey the icon;
// mana / AG / delay still block the cast, without greying it.
describe('a skill below its old level requirement', () => {
  /** test0Dk as photographed: Dark Knight, level 150, full mana and AG. */
  function heroAt(level: number, mp = 500, ag = 500): void {
    runInAction(() => {
      Hero.charClass = CharacterClassNumber.DarkKnight;
      Hero.level = level;
      Hero.eng = 100;
      Hero.currentMP = mp;
      Hero.currentAG = ag;
      Hero.tileFlag = 0;
    });
  }

  it('is bright and usable: Rageful Blow (170) and Death Stab (160) at level 150', () => {
    heroAt(150);
    HeroSkills.setSkillList([
      { index: 0, number: 42, level: 0 },
      { index: 1, number: 43, level: 0 },
    ]);
    for (const num of [42, 43]) {
      const v = skillUsability(num);
      expect(v.blocks).toEqual([]);
      expect(v.requirementsMet).toBe(true);
      expect(v.usable).toBe(true);
    }
  });

  it('still refuses the cast when short on mana, without greying the icon', () => {
    heroAt(150, 0, 500);
    HeroSkills.setSkillList([{ index: 0, number: 42, level: 0 }]);
    const v = skillUsability(42);
    expect(v.requirementsMet).toBe(true);
    expect(v.blocks).toEqual(['mana']);
    expect(v.usable).toBe(false);
  });

  it('still refuses the cast when short on AG, without greying the icon', () => {
    heroAt(150, 500, 0);
    HeroSkills.setSkillList([{ index: 0, number: 42, level: 0 }]);
    const v = skillUsability(42);
    expect(v.requirementsMet).toBe(true);
    expect(v.blocks).toEqual(['ag']);
    expect(v.usable).toBe(false);
  });

  it('still refuses the cast while cooling down, without greying the icon', () => {
    heroAt(150);
    HeroSkills.setSkillList([{ index: 0, number: 42, level: 0 }]);
    // No delay is registered in the test env: lend the skill one, then give it back.
    const delays = SKILL_DELAY_MS as unknown as Record<number, number>;
    delays[42] = 5000;
    expect(startSkillCooldown(42)).toBe(true);
    try {
      const v = skillUsability(42);
      expect(v.requirementsMet).toBe(true);
      expect(v.blocks).toEqual(['cooldown']);
      expect(v.usable).toBe(false);
    } finally {
      cooldownsLayer.reset?.();
      delete delays[42];
    }
  });
});
