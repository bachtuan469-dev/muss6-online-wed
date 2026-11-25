/** French text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Centrer',
  'minimap.collapse': 'Replier',
  'minimap.expand': 'Déplier',
} satisfies Partial<Record<keyof typeof en, string>>;
