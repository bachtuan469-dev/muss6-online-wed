/** Vietnamese text of the `inventory` window. */

import type en from './en';

export default {
  'inventory.title': 'Hành trang',
  'inventory.close': 'Đóng (I,V)',
  'inventory.repair': 'Sửa đồ (L)',
  'inventory.personalShop': 'Cửa hàng cá nhân',
  'inventory.expand': 'Mở hành trang mở rộng (K)',
  'inventory.useItem': 'Dùng',
  'inventory.equipItem': 'Mặc',
  'inventory.learnSkill': 'Học',
} satisfies Partial<Record<keyof typeof en, string>>;
