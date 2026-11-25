/** Chinese text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': '启动助手',
  'muHelperButtons.stop': '停止助手',
  'muHelperButtons.settings': '助手设置',
  'muHelperButtons.command': '命令',
  'muHelperButtons.characterInfo': '角色信息',
  'muHelperButtons.inventory': '背包',
  'muHelperButtons.keyboard': '键盘',
  'muHelperButtons.move': '移动列表',
  'muHelperButtons.escape': '关闭 / 菜单',
  'muHelperButtons.master': '大师技能',
} satisfies Partial<Record<keyof typeof en, string>>;
