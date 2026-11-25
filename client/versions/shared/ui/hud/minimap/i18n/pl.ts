/** Polish text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Wyśrodkuj',
  'minimap.collapse': 'Zwiń',
  'minimap.expand': 'Rozwiń',
} satisfies Partial<Record<keyof typeof en, string>>;
