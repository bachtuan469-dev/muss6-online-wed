/** English text of the `mu_helper_buttons` HUD element. See src/i18n/readme.md. */

const en = {
  'muHelperButtons.start': 'Start helper',
  'muHelperButtons.stop': 'Stop helper',
  'muHelperButtons.settings': 'Helper settings',
  'muHelperButtons.command': 'Command',
  'muHelperButtons.characterInfo': 'Character info',
  'muHelperButtons.inventory': 'Inventory',
  'muHelperButtons.keyboard': 'Keyboard',
  'muHelperButtons.move': 'Move list',
  'muHelperButtons.escape': 'Close / Menu',
  'muHelperButtons.master': 'Master skills',
};

export default en;

declare module '@/i18n' {
  interface TextOwners {
    'versions/shared/ui/hud/mu_helper_buttons': typeof en;
  }
}
