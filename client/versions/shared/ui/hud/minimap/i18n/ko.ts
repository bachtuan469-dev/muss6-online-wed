/** Korean text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': '가운데로',
  'minimap.collapse': '접기',
  'minimap.expand': '펼치기',
} satisfies Partial<Record<keyof typeof en, string>>;
