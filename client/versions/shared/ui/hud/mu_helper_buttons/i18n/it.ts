/** Italian text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Avvia assistente',
  'muHelperButtons.stop': 'Ferma assistente',
  'muHelperButtons.settings': 'Impostazioni assistente',
  'muHelperButtons.command': 'Comando',
  'muHelperButtons.characterInfo': 'Info personaggio',
  'muHelperButtons.inventory': 'Inventario',
  'muHelperButtons.keyboard': 'Tastiera',
  'muHelperButtons.move': 'Elenco spostamenti',
  'muHelperButtons.escape': 'Chiudi / Menu',
  'muHelperButtons.master': 'Abilità Master',
} satisfies Partial<Record<keyof typeof en, string>>;
