import { existsSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

/**
 * The preloader, trimmed to what the user asked for: the protected credits,
 * the minimal 0.97 loading (classic art, one bar, particles) and the way in
 * (worlds card, setup, download, Enter). Everything else that used to dress
 * the page - the status line with its GitHub link, the header, the logo and
 * its lightning, the hellfire, the footer strike, the card's headline - is
 * gone, and this test fails if any of it comes back.
 */

const dir = 'versions/shared/ui/pages/preloader';
const index = readFileSync(`${dir}/index.tsx`, 'utf8');
const backdrop = readFileSync(`${dir}/backdrop.tsx`, 'utf8');
const style = readFileSync(`${dir}/style.less`, 'utf8');
const direct = readFileSync(`${dir}/directLoad.tsx`, 'utf8');
const directStyle = readFileSync(`${dir}/directLoad.less`, 'utf8');

describe('the preloader, trimmed to credits + 0.97 + enter', () => {
  it.each([
    'ws-status',
    'ws-github',
    'GITHUB_URL',
    'LogoLight',
    'LightningLine',
    'FooterStrike',
    'Hellfire',
    'HELLFIRE_SOUND',
    'ws-top',
    'LanguagePicker',
    'ws-marker',
    'ws-headline',
    'ws-lead',
    'ws-unfold',
    'showPanel',
    'hidePanel',
    'panelHidden',
  ])('index.tsx has no %s', gone => {
    expect(index).not.toContain(gone);
  });

  it('keeps the way in: the worlds card, setup, download and Enter', () => {
    for (const kept of [
      'WorldsView',
      'SetupView',
      'DownloadView',
      'LoadingRunner',
      'Backdrop',
      'ws-enter',
      'setWorldsOpen',
    ])
      expect(index).toContain(kept);
  });

  it('keeps the credits: the classic art, the particles and the credit card', () => {
    for (const kept of ['ws-classic-bg', 'Embers', 'ws-credit', 'loadCredits'])
      expect(backdrop).toContain(kept);
  });

  it.each([
    'logoLight.tsx',
    'lightningLine.tsx',
    'footerStrike.tsx',
    'hellfire.tsx',
    'bolt.ts',
    'sparkSprites.ts',
  ])('the %s decoration file is gone', file => {
    expect(existsSync(`${dir}/${file}`)).toBe(false);
  });

  it('the ?direct page has no logo', () => {
    expect(direct).not.toContain('dl-logo');
    expect(direct).not.toContain('LOGO');
    expect(directStyle).not.toContain('.dl-logo');
  });

  it('the preloader stylesheet has no rules for the removed pieces', () => {
    for (const gone of [
      '.ws-top',
      '.ws-logo',
      '.ws-strike',
      '.ws-footer-strike',
      '.ws-hellfire',
      '.ws-unfold',
      '.ws-marker',
      '.ws-headline',
      '.ws-lead',
      '.ws-status',
      '.ws-github',
      '.ws-language',
      'is-panel-hidden',
    ])
      expect(style).not.toContain(gone);
  });
});
