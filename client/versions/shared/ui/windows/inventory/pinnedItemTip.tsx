import { observer } from 'mobx-react-lite';
import { createPortal } from 'react-dom';
import type { Item } from '@/ecs/world';
import { Hero } from '@/modules/hero';
import { Economy } from '@/modules/economy/economy';
import { t } from '@/i18n';
import { ItemTooltip } from '../../components/item_tooltip';
import { pinnedTipAction } from './pinnedTip';

/**
 * FIX24 Việc 7: the tooltip a held item pins in place, with one action
 * button for what the right click would have done with it. The backdrop
 * sits under the tooltip (z 1100, the tooltip is 1200) and above every
 * window, so a tap anywhere else dismisses it. The action is the item's
 * intrinsic one - learn, use or wear; with a storage window open the
 * right click would shuttle the item instead, so the button hides there.
 */
const ACTION_KEY = {
  learn: 'inventory.learnSkill',
  use: 'inventory.useItem',
  equip: 'inventory.equipItem',
} as const;

export const PinnedItemTip = observer(
  ({
    item,
    slot,
    x,
    y,
    onAction,
    onClose,
  }: {
    item: Item;
    slot: number;
    x: number;
    y: number;
    /** Runs the right-click chain for this item, then closes the tip. */
    onAction: () => void;
    onClose: () => void;
  }) => {
    const action =
      Economy.autoMoveTarget === null ? pinnedTipAction(item, Hero.items) : null;

    return createPortal(
      <>
        <div className="pinned-tip-backdrop" onPointerDown={onClose} />
        <ItemTooltip
          item={item}
          x={x}
          y={y}
          context="inventory"
          slot={slot}
          pinned
          action={
            action === null
              ? undefined
              : { label: t(ACTION_KEY[action]), onAction }
          }
        />
      </>,
      document.body
    );
  }
);
