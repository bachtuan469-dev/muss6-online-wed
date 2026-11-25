/** Vietnamese text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': 'Căn giữa',
  'minimap.collapse': 'Thu gọn',
  'minimap.expand': 'Mở rộng',
} satisfies Partial<Record<keyof typeof en, string>>;
