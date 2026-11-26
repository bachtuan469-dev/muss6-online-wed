import { describe, expect, it } from 'vitest';
import { itemLevelName } from './itemLevelLook';
import { liveItemIconKey } from '../interface/item_icons/liveItemIcon';
import { itemIconPose } from '../interface/item_icons/itemIconPose';

const POTION = 14;
const BOX_OF_LUCK = 11;

const name = (lvl: number) => itemLevelName(POTION, BOX_OF_LUCK, lvl, 'Box of Luck');

describe('Box of Luck by level', () => {
  it('names each level as the item it is', () => {
    expect(name(0)).toBe('Box of Luck');
    expect(name(1)).toBe('Star of Sacred Birth');
    expect(name(6)).toBe('Gold Medal');
    expect(name(13)).toBe('Heart of Dark Lord');
    expect(name(15)).toBe('Red Lucky Pouch');
  });

  it('counts the Box of Kundun from +1 at level 8', () => {
    expect(name(8)).toBe('Box of Kundun +1');
    expect(name(12)).toBe('Box of Kundun +5');
  });

  it('keeps the box and its level where the original has no other name', () => {
    expect(name(4)).toBe('Box of Luck +4');
  });

  it('draws each level with its own live picture, not one shared tint', () => {
    // The live key carries the level, so no two levels share one picture.
    const keys = [0, 1, 2, 4, 8, 10, 12, 14].map(lvl => liveItemIconKey({ group: POTION, num: BOX_OF_LUCK, lvl }));
    expect(new Set(keys).size).toBe(keys.length);
    // And the bag swaps the model per level (RenderItem3D, ZzzInventory.cpp:6817-6848).
    expect(itemIconPose(POTION, BOX_OF_LUCK, 1, false).model?.file).toBe('Item/MagicBox02.glb');
    expect(itemIconPose(POTION, BOX_OF_LUCK, 2, false).model?.file).toBe('Item/MagicBox03.glb');
    expect(itemIconPose(POTION, BOX_OF_LUCK, 5, false).model?.file).toBe('Item/MagicBox06.glb');
    expect(itemIconPose(POTION, BOX_OF_LUCK, 8, false).model?.file).toBe('Item/MagicBox08.glb');
  });
});
