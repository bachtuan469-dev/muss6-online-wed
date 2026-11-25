/** Russian text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Запустить помощника',
  'muHelperButtons.stop': 'Остановить помощника',
  'muHelperButtons.settings': 'Настройки помощника',
  'muHelperButtons.command': 'Команда',
  'muHelperButtons.characterInfo': 'Информация о персонаже',
  'muHelperButtons.inventory': 'Инвентарь',
  'muHelperButtons.keyboard': 'Клавиатура',
  'muHelperButtons.move': 'Список перемещений',
  'muHelperButtons.escape': 'Закрыть / Меню',
  'muHelperButtons.master': 'Навыки Мастера',
} satisfies Partial<Record<keyof typeof en, string>>;
