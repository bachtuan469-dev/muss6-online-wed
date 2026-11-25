/** English text of the `minimap` HUD element. See src/i18n/readme.md. */

const en = {
  'minimap.center': 'Center',
  'minimap.collapse': 'Collapse',
  'minimap.expand': 'Expand',
};

export default en;

declare module '@/i18n' {
  interface TextOwners {
    'versions/shared/ui/hud/minimap': typeof en;
  }
}
