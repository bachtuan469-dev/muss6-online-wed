/** el text of `versions/shared/ui/hud/mu_helper_buttons`. */

import type en from './en';

export default {
  'muHelperButtons.start': 'Έναρξη βοηθού',
  'muHelperButtons.stop': 'Διακοπή βοηθού',
  'muHelperButtons.settings': 'Ρυθμίσεις βοηθού',
  'muHelperButtons.command': 'Εντολή',
  'muHelperButtons.characterInfo': 'Πληροφορίες χαρακτήρα',
  'muHelperButtons.inventory': 'Απόθεμα',
  'muHelperButtons.keyboard': 'Πληκτρολόγιο',
  'muHelperButtons.move': 'Λίστα μετακίνησης',
  'muHelperButtons.escape': 'Κλείσιμο / Μενού',
  'muHelperButtons.master': 'Δεξιότητες Master',
} satisfies Partial<Record<keyof typeof en, string>>;
