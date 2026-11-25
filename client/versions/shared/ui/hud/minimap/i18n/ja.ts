/** Japanese text of the `minimap` HUD element. */

import type en from './en';

export default {
  'minimap.center': '中央に戻す',
  'minimap.collapse': '折りたたむ',
  'minimap.expand': '展開する',
} satisfies Partial<Record<keyof typeof en, string>>;
