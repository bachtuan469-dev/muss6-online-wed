/** Thai text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'เริ่มตัวช่วย',
  'muHelperButtons.stop': 'หยุดตัวช่วย',
  'muHelperButtons.settings': 'ตั้งค่าตัวช่วย',
  'muHelperButtons.command': 'คำสั่ง',
  'muHelperButtons.characterInfo': 'ข้อมูลตัวละคร',
  'muHelperButtons.inventory': 'กระเป๋า',
  'muHelperButtons.keyboard': 'คีย์บอร์ด',
  'muHelperButtons.move': 'รายการย้ายแผนที่',
  'muHelperButtons.escape': 'ปิด / เมนู',
  'muHelperButtons.master': 'สกิล Master',
} satisfies Partial<Record<keyof typeof en, string>>;
