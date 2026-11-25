/** Portuguese text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Iniciar ajudante',
  'muHelperButtons.stop': 'Parar ajudante',
  'muHelperButtons.settings': 'Ajustes do ajudante',
  'muHelperButtons.command': 'Comando',
  'muHelperButtons.characterInfo': 'Info do personagem',
  'muHelperButtons.inventory': 'Inventário',
  'muHelperButtons.keyboard': 'Teclado',
  'muHelperButtons.move': 'Lista de viagem',
  'muHelperButtons.escape': 'Fechar / Menu',
  'muHelperButtons.master': 'Habilidades Master',
} satisfies Partial<Record<keyof typeof en, string>>;
