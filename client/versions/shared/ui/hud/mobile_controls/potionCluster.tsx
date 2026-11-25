import { observer } from 'mobx-react-lite';
import { gameVersion } from '@/version';
import { bottomBarScreenHeight } from '@/controllers/interface/components/mu_window';
import { ConsumableItem } from '../bottom_bar/consumableItem';
import {
  HUD_BOTTOM_GAP,
  POTION_CLUSTER_LEFT,
  POTION_ICON_GAP,
  POTION_ICON_SIZE,
} from './consts';

/**
 * FIX22 Việc 7: on a phone the Q/W/E/R slots leave the bottom bar and sit
 * as icons right of the move stick, above the chat log. Each is 28x28, shows
 * what it holds and how many, and a tap drinks it (`potionTap`). Binding a
 * kind stays Ctrl+key over the inventory.
 *
 * FIX23 Việc 4: the slot's `position: absolute` came from the
 * `.bottom-bar .consumable-item` rule, which never applies outside the bar,
 * so the inline left/top were ignored and the four icons stacked vertically
 * while their counts piled on one spot. Each slot now carries its own
 * positioned frame: the row is a row, the count sits on its own icon, and
 * an empty slot still shows its frame. No key labels - icon and count only.
 *
 * FIX24 Việc 11: the row rides the bottom now, one gap above the bar,
 * beside the move stick.
 */
export const PotionCluster = observer(() => {
  const slots = gameVersion.features.itemHotkeys.slots;
  const keys = ['Q', 'W', 'E', 'R'];

  return (
    <div
      className="potion-cluster"
      style={{
        position: 'absolute',
        left: POTION_CLUSTER_LEFT,
        bottom: bottomBarScreenHeight() + HUD_BOTTOM_GAP,
      }}
    >
      {keys.slice(0, slots).map((key, i) => (
        <div
          key={key}
          className="potion-slot"
          style={{
            position: 'absolute',
            left: i * (POTION_ICON_SIZE + POTION_ICON_GAP),
            top: 0,
            width: POTION_ICON_SIZE,
            height: POTION_ICON_SIZE,
            borderRadius: 6,
            background: 'rgba(0,0,0,0.45)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
          }}
        >
          <ConsumableItem key={key} index={i} hotKey={key} x={0} y={0} size={POTION_ICON_SIZE} floating />
        </div>
      ))}
    </div>
  );
});
