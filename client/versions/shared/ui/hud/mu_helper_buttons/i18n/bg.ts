/** Bulgarian text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Старт на помощника',
  'muHelperButtons.stop': 'Стоп на помощника',
  'muHelperButtons.settings': 'Настройки на помощника',
  'muHelperButtons.command': 'Команда',
  'muHelperButtons.characterInfo': 'Информация за героя',
  'muHelperButtons.inventory': 'Инвентар',
  'muHelperButtons.keyboard': 'Клавиатура',
  'muHelperButtons.move': 'Списък за местене',
  'muHelperButtons.escape': 'Затвори / Меню',
  'muHelperButtons.master': 'Майсторски умения',
} satisfies Partial<Record<keyof typeof en, string>>;
