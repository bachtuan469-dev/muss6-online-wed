/** Italian text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Centra',
  'minimap.collapse': 'Riduci',
  'minimap.expand': 'Espandi',
} satisfies Partial<Record<keyof typeof en, string>>;
