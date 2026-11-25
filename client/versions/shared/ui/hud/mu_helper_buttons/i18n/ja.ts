/** Japanese text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'ヘルパー開始',
  'muHelperButtons.stop': 'ヘルパー停止',
  'muHelperButtons.settings': 'ヘルパー設定',
  'muHelperButtons.command': 'コマンド',
  'muHelperButtons.characterInfo': 'キャラクター情報',
  'muHelperButtons.inventory': 'インベントリ',
  'muHelperButtons.keyboard': 'キーボード',
  'muHelperButtons.move': '移動リスト',
  'muHelperButtons.escape': '閉じる / メニュー',
  'muHelperButtons.master': 'マスタースキル',
} satisfies Partial<Record<keyof typeof en, string>>;
