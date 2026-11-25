/** Bulgarian text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Центрирай',
  'minimap.collapse': 'Свиване',
  'minimap.expand': 'Разгръщане',
} satisfies Partial<Record<keyof typeof en, string>>;
