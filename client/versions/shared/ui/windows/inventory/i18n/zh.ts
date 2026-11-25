/** Chinese text of the `inventory` window. */

import type en from './en';

export default {
  'inventory.title': '背包',
  'inventory.close': '关闭（I、V）',
  'inventory.repair': '修理（L）',
  'inventory.personalShop': '个人商店',
  'inventory.expand': '打开扩展背包（K）',
  'inventory.useItem': '使用',
  'inventory.equipItem': '装备',
  'inventory.learnSkill': '学习',
} satisfies Partial<Record<keyof typeof en, string>>;
