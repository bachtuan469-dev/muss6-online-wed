/** Chinese text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': '居中',
  'minimap.collapse': '收起',
  'minimap.expand': '展开',
} satisfies Partial<Record<keyof typeof en, string>>;
