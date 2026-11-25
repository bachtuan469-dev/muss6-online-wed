/** Romanian text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Centrează',
  'minimap.collapse': 'Restrânge',
  'minimap.expand': 'Extinde',
} satisfies Partial<Record<keyof typeof en, string>>;
