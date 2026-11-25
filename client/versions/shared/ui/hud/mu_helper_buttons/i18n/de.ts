/** German text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Helfer starten',
  'muHelperButtons.stop': 'Helfer stoppen',
  'muHelperButtons.settings': 'Helfer-Einstellungen',
  'muHelperButtons.command': 'Befehl',
  'muHelperButtons.characterInfo': 'Charakterinfo',
  'muHelperButtons.inventory': 'Inventar',
  'muHelperButtons.keyboard': 'Tastatur',
  'muHelperButtons.move': 'Zielauswahl',
  'muHelperButtons.escape': 'Schließen / Menü',
  'muHelperButtons.master': 'Meister-Fähigkeiten',
} satisfies Partial<Record<keyof typeof en, string>>;
