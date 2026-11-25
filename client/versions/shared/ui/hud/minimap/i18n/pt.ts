/** Portuguese text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Centrar',
  'minimap.collapse': 'Recolher',
  'minimap.expand': 'Expandir',
} satisfies Partial<Record<keyof typeof en, string>>;
