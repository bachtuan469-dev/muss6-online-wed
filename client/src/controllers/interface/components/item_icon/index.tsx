import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { Item } from '@/ecs/world';
import { liveItemIcon, liveItemIconKey, liveItemIconState, spinLiveItemIcon } from '@/controllers/interface/item_icons/liveItemIcon';

/** The turning picture covers the item's squares, as the live still does. */
const SPIN_STYLE = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' } as const;

/**
 * The item under the cursor turning on a canvas (`Select` in RenderObjectScreen,
 * ZzzInventory.cpp:8856-8859); the still picture shows until the first turned one is drawn.
 */
const Spin = observer(function Spin({ item, still }: { item: Item; still: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const look = liveItemIconKey(item);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return undefined;
    const stop = spinLiveItemIcon(item, target, () => setReady(true));
    return () => {
      stop?.();
      setReady(false);
    };
    // The look is what the picture depends on; the item object may be rebuilt by a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look]);
  return (
    <>
      {!ready && still}
      <canvas ref={canvas} className="item-icon" style={SPIN_STYLE} />
    </>
  );
});

/**
 * An item's icon drawn from its model (`item_icons/liveItemIcon.ts`): the
 * live picture once drawn, an empty cell while it draws or when the item
 * has no model. `spin`: the item is under the cursor, so its model turns
 * over the still picture.
 *
 * An observer leaf taking the item itself: only the fields the live look
 * depends on (`liveItemIconKey`) are read here, so a durability tick or an
 * option change on one item re-renders nothing - the grid above passes the
 * same `item` reference and this memo skips. (The old `{...item}` spread
 * subscribed the whole grid to all fourteen fields of every item.)
 */
export const ItemIcon = memo(
  observer(function ItemIcon({ item, spin = false }: { item: Item; spin?: boolean }) {
    const still = stillIcon(item);
    return spin ? <Spin item={item} still={still} /> : still;
  })
);

/** The still picture: the live one drawn from the model, else an empty cell. */
function stillIcon(item: Item): ReactNode {
  // The original draws every icon from the model (RenderItem3D, ZzzInventory.cpp:9707), so the
  // live picture is the only picture: it carries the item's glow. While it
  // draws, or when the item has no model, the cell stays empty and
  // transparent - no static picture, no missing-icon square, no broken image.
  if (liveItemIconState(item) === 'ready') {
    const url = liveItemIcon(item);
    if (url) {
      return <img src={url} className="item-icon" alt="" draggable={false} decoding="async" />;
    }
  }

  return <div className="item-icon" />;
}
