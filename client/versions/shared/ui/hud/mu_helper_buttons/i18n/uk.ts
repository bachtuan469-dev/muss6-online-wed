/** uk text of `versions/shared/ui/hud/mu_helper_buttons`. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Запустити helper',
  'muHelperButtons.stop': 'Зупинити helper',
  'muHelperButtons.settings': 'Налаштування helper',
  'muHelperButtons.command': 'Команда',
  'muHelperButtons.characterInfo': 'Інформація про персонажа',
  'muHelperButtons.inventory': 'Інвентар',
  'muHelperButtons.keyboard': 'Клавіатура',
  'muHelperButtons.move': 'Список переміщень',
  'muHelperButtons.escape': 'Закрити / Меню',
  'muHelperButtons.master': 'Навички Майстра',
} satisfies Partial<Record<keyof typeof en, string>>;
