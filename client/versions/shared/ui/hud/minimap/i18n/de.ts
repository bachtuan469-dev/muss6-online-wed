/** German text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Zentrieren',
  'minimap.collapse': 'Einklappen',
  'minimap.expand': 'Ausklappen',
} satisfies Partial<Record<keyof typeof en, string>>;
