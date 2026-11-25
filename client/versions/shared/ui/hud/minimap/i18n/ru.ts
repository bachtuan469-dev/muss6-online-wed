/** Russian text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Центрировать',
  'minimap.collapse': 'Свернуть',
  'minimap.expand': 'Развернуть',
} satisfies Partial<Record<keyof typeof en, string>>;
