/** Thai text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'กลับไปตรงกลาง',
  'minimap.collapse': 'ย่อ',
  'minimap.expand': 'ขยาย',
} satisfies Partial<Record<keyof typeof en, string>>;
