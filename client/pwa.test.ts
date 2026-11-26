// PWA install surface: what a phone needs to add the game to its home
// screen and open it standalone. Reads the served files, not the code.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('./', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
  name?: string;
  short_name?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  background_color?: string;
  theme_color?: string;
  icons?: { src: string; sizes: string; type: string; purpose?: string }[];
};

describe('pwa install surface', () => {
  it('links the manifest and the iOS touch icon', () => {
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />');
  });

  it('marks the page capable of standalone mode on iOS and Android', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="OpenMUCB" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black" />');
  });

  it('uses a viewport that fills the iPhone notch area', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('manifest opens standalone from the site root', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
  });

  it('manifest icons exist on disk in every required size', () => {
    const byKey = new Map((manifest.icons ?? []).map(i => [`${i.sizes}/${i.purpose ?? 'any'}`, i.src]));
    expect(byKey.get('192x192/any')).toBeTruthy();
    expect(byKey.get('512x512/any')).toBeTruthy();
    expect(byKey.get('512x512/maskable')).toBeTruthy();
    for (const icon of manifest.icons ?? []) {
      expect(existsSync(new URL(`public/${icon.src.replace(/^\.\//, '')}`, root))).toBe(true);
    }
    expect(existsSync(new URL('public/icons/apple-touch-icon.png', root))).toBe(true);
  });

  it('service worker is build-versioned so a deploy never strands an old build', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain('mu-assets-');
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain("searchParams.get('build')");
    expect(sw).toContain('dropOtherBuilds');
    expect(read('src/controllers/assets/assetDownload.ts')).toContain('sw.js?build=');
  });
});
