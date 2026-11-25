/** Bulgarian text of the `inventory` window. */

import type en from './en';

export default {
  'inventory.title': 'Раница',
  'inventory.close': 'Затвори (I,V)',
  'inventory.repair': 'Поправи (L)',
  'inventory.personalShop': 'Личен магазин',
  'inventory.expand': 'Отвори разширената раница (K)',
  'inventory.useItem': 'Използвай',
  'inventory.equipItem': 'Екипирай',
  'inventory.learnSkill': 'Научи',
} satisfies Partial<Record<keyof typeof en, string>>;
