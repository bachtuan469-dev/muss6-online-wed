/** French text of the `mu_helper_buttons` HUD element. */

import type en from './en';

export default {
  'muHelperButtons.start': "Lancer l'assistant",
  'muHelperButtons.stop': "Arrêter l'assistant",
  'muHelperButtons.settings': "Réglages de l'assistant",
  'muHelperButtons.command': 'Commande',
  'muHelperButtons.characterInfo': 'Infos personnage',
  'muHelperButtons.inventory': 'Inventaire',
  'muHelperButtons.keyboard': 'Clavier',
  'muHelperButtons.move': 'Liste de déplacement',
  'muHelperButtons.escape': 'Fermer / Menu',
  'muHelperButtons.master': 'Compétences Master',
} satisfies Partial<Record<keyof typeof en, string>>;
