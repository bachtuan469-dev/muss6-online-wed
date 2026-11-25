/** Polish text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Włącz pomocnika',
  'muHelperButtons.stop': 'Wyłącz pomocnika',
  'muHelperButtons.settings': 'Ustawienia pomocnika',
  'muHelperButtons.command': 'Polecenie',
  'muHelperButtons.characterInfo': 'Informacje o postaci',
  'muHelperButtons.inventory': 'Ekwipunek',
  'muHelperButtons.keyboard': 'Klawiatura',
  'muHelperButtons.move': 'Lista podróży',
  'muHelperButtons.escape': 'Zamknij / Menu',
  'muHelperButtons.master': 'Umiejętności Mistrza',
} satisfies Partial<Record<keyof typeof en, string>>;
