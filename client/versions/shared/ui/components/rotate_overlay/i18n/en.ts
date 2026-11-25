/** English text of the `rotate_overlay` UI component. See src/i18n/readme.md. */

const en = {
  'rotate.prompt': 'Turn your device sideways to play',
};

export default en;

declare module '@/i18n' {
  interface TextOwners {
    'versions/shared/ui/components/rotate_overlay': typeof en;
  }
}
