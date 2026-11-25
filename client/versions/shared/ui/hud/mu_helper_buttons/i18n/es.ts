/** Spanish text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Activar ayudante',
  'muHelperButtons.stop': 'Detener ayudante',
  'muHelperButtons.settings': 'Ajustes del ayudante',
  'muHelperButtons.command': 'Comando',
  'muHelperButtons.characterInfo': 'Info de personaje',
  'muHelperButtons.inventory': 'Inventario',
  'muHelperButtons.keyboard': 'Teclado',
  'muHelperButtons.move': 'Lista de viaje',
  'muHelperButtons.escape': 'Cerrar / Menú',
  'muHelperButtons.master': 'Habilidades Master',
} satisfies Partial<Record<keyof typeof en, string>>;
