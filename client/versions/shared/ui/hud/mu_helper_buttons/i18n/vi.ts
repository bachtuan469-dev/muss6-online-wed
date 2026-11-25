/** Vietnamese text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Bật trợ thủ',
  'muHelperButtons.stop': 'Tắt trợ thủ',
  'muHelperButtons.settings': 'Cài đặt trợ thủ',
  'muHelperButtons.command': 'Lệnh',
  'muHelperButtons.characterInfo': 'Thông tin nhân vật',
  'muHelperButtons.inventory': 'Hành trang',
  'muHelperButtons.keyboard': 'Bàn phím',
  'muHelperButtons.move': 'Danh sách di chuyển',
  'muHelperButtons.escape': 'Đóng / Menu',
  'muHelperButtons.master': 'Kỹ năng Master',
} satisfies Partial<Record<keyof typeof en, string>>;
