import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { t } from '@/i18n';
import { Bag } from '@/modules/inventory';
import { Hero } from '@/modules/hero';
import { ItemIcon } from '@/controllers/interface/components/item_icon';
import { MuNumber } from '@/controllers/interface/components/mu_number';
import { Item } from '@/ecs/world';
import { gameVersion } from '@/version';
import { itemBaseName } from '@versions/shared/items/itemsDatabase';
import {
  canBindItemHotkey,
  canRegisterItemHotkey,
  countHotkeyItems,
  findHotkeyItem,
} from '@/modules/inventory/itemHotkeys';
import { potionTapDown, potionTapUp } from '../mobile_controls/potionTap';

export type ConsumableItemProps = {
  index: number;
  hotKey: string;
  /** Slot box, in the offset parent's pixels. */
  x: number;
  y: number;
  size: number;
  /** Where the count sits in the bar (below the slot). Unused floating. */
  countX?: number;
  countY?: number;
  /**
   * Floating (beside the move stick): a tap drinks, and the count overlays
   * the icon instead of sitting below it.
   */
  floating?: boolean;
};

/**
 * One Q/W/E/R slot (`CNewUIItemHotKey`): shows the best matching potion the
 * inventory holds right now and the summed count. Right click drinks it
 * (`UseItemRButton`); where the version's slots bind, a carried potion dropped
 * here binds the slot to that kind, the way Ctrl+key over the inventory does.
 */
export const ConsumableItem = observer(
  ({ index, hotKey, x, y, size, countX, countY, floating }: ConsumableItemProps) => {
    const items = Hero.items;
    const hotkey = Bag.itemHotkeys[index];
    const slot = findHotkeyItem(items, index, hotkey);
    const icon: Item | null = slot >= 0 ? items[slot] : null;
    const count = slot >= 0 ? countHotkeyItems(items, index, hotkey) : 0;
    const picked = Bag.pickedItem;
    const canBind =
      !!picked &&
      canRegisterItemHotkey(picked.item) &&
      canBindItemHotkey(gameVersion.features.itemHotkeys, index);
    const name = icon ? itemBaseName(icon.group, icon.num) : undefined;
    const boundTap = useRef(false);

    return (
      <>
        <div
          className={`consumable-item${canBind ? ' can-bind' : ''}`}
          title={
            name
              ? t('bottomBar.itemSlot', { name, key: hotKey })
              : t('bottomBar.emptySlot', { key: hotKey })
          }
          style={{
            left: x,
            top: y,
            width: size,
            height: size,
            // The touch layer is transparent to taps; a floating icon opts
            // back in, the way the sticks do.
            pointerEvents: floating ? 'auto' : undefined,
          }}
          onPointerDown={event => {
            if (event.button !== 0 || !picked) return;
            event.stopPropagation();
            const bind = () => {
              Bag.setItemHotkey(index, picked.item);
              Bag.cancelPickedItem();
            };
            if (floating) {
              boundTap.current = potionTapDown(true, canBind, bind);
              return;
            }
            if (!canBind) return;
            bind();
          }}
          onPointerUp={
            floating
              ? () => {
                  potionTapUp(boundTap.current, () => Bag.useItemHotkey(index));
                  boundTap.current = false;
                }
              : undefined
          }
          onContextMenu={event => {
            event.preventDefault();
            event.stopPropagation();
            Bag.useItemHotkey(index);
          }}
        >
          {!!icon && <ItemIcon item={icon} />}
          {floating && count > 0 && (
            <MuNumber value={count} x={size - 8} y={size - 12} />
          )}
        </div>
        {!floating && count > 0 && (
          <MuNumber value={count} x={countX ?? 0} y={countY ?? 0} />
        )}
      </>
    );
  }
);
