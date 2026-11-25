/** Spanish text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Centrar',
  'minimap.collapse': 'Plegar',
  'minimap.expand': 'Desplegar',
} satisfies Partial<Record<keyof typeof en, string>>;
