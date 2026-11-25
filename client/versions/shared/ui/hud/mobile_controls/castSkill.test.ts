import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ecs } from '@/ecs/current';
import type { Entity, World } from '@/ecs/world';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

const { HeroSkills } = await import('@/modules/skills');
const { castTouchSkill } = await import('./castSkill');

const hero = () =>
  ({
    transform: { pos: new Vector3(100.5, 0, 100.5), rot: { y: 0 }, scale: 1 },
    dying: false,
    attributeSystem: { isAboveZero: () => false },
  }) as unknown as Entity;

const monsterAt = (x: number, z: number) =>
  ({
    netId: 7,
    npcType: 3,
    worldIndex: 0,
    transform: { pos: new Vector3(x, 0, z), rot: new Vector3(), scale: 1 },
  }) as unknown as Entity;

const mockWorld = (monsters: Entity[]) =>
  ({
    playerEntity: hero(),
    attackTarget: null,
    castRequest: null,
    netObjsQuery: { entities: monsters },
    getTerrainFlag: () => 0,
  }) as unknown as World;

afterEach(() => {
  runInAction(() => {
    Ecs.world = null;
  });
  HeroSkills.setSkillList([]);
});

// `Ecs.world` is a deep observable: assigning a plain mock stores a
// converted copy, so the assertions below read the live world back and
// compare by tile, never by object identity with the literal.
const liveWorld = (): World => Ecs.world as unknown as World;
const targetX = (w: World): number | undefined =>
  (w.attackTarget as unknown as Entity)?.transform?.pos.x;
const castTargetX = (w: World): number | undefined =>
  (w.castRequest?.target as unknown as Entity)?.transform?.pos.x;

describe('castTouchSkill auto-target (a skill that needs a target)', () => {
  it('takes the nearest monster when nothing is targeted', () => {
    const world = mockWorld([monsterAt(103.5, 100.5)]);
    runInAction(() => {
      Ecs.world = world;
    });
    HeroSkills.setSkillList([{ index: 0, number: 3, level: 0 }]);
    castTouchSkill(3);
    const live = liveWorld();
    expect(targetX(live)).toBe(103.5);
    expect(castTargetX(live)).toBe(103.5);
  });

  it('keeps a valid target instead of re-picking', () => {
    const world = mockWorld([monsterAt(103.5, 100.5), monsterAt(110.5, 100.5)]);
    const kept = world.netObjsQuery.entities[0];
    world.attackTarget = kept;
    runInAction(() => {
      Ecs.world = world;
    });
    HeroSkills.setSkillList([{ index: 0, number: 3, level: 0 }]);
    castTouchSkill(3);
    const live = liveWorld();
    expect(targetX(live)).toBe(103.5);
    expect(castTargetX(live)).toBe(103.5);
  });

  it('casts at the hero tile when no monster is in reach, as before', () => {
    const world = mockWorld([]);
    runInAction(() => {
      Ecs.world = world;
    });
    HeroSkills.setSkillList([{ index: 0, number: 3, level: 0 }]);
    castTouchSkill(3);
    const live = liveWorld();
    expect(live.attackTarget).toBeNull();
    expect(live.castRequest?.target).toBeNull();
    expect(live.castRequest?.point).toEqual({ x: 100.5, y: 100.5 });
  });

  it('never acquires a target for a self cast (Swell Life)', () => {
    const world = mockWorld([monsterAt(103.5, 100.5)]);
    runInAction(() => {
      Ecs.world = world;
    });
    HeroSkills.setSkillList([{ index: 0, number: 48, level: 0 }]);
    castTouchSkill(48);
    const live = liveWorld();
    expect(live.attackTarget).toBeNull();
    expect(live.castRequest?.target).toBeNull();
    expect(live.castRequest?.point).toEqual({ x: 100.5, y: 100.5 });
  });
});
