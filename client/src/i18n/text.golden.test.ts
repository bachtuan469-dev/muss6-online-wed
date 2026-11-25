import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { EN_TEXT, i18n, t, type TextKey } from './index';

/**
 * Pins what `t(key)` returns for every key in every language, switching the
 * language through the engine, plus each language's selector metadata. Moving
 * text between files must leave every hash as it is.
 */

const KEYS = (Object.keys(EN_TEXT) as TextKey[]).sort();

function languageHash(code: string): string {
  i18n.setLanguage(code);
  expect(i18n.language).toBe(code);

  const layer = i18n.current;
  const pack = layer.dataPack;
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify([
      layer.name, layer.code, layer.aliases ?? [], layer.label, layer.region, layer.font ?? '',
      pack ? [pack.folder, pack.suffix, pack.encoding ?? '', !!pack.repairs, !!pack.itemNames, !!pack.dialogPages] : null,
    ])
  );
  for (const key of KEYS) hash.update(`${key}\t${t(key)}\t${i18n.translated(key)}\n`);
  return hash.digest('hex').slice(0, 16);
}

describe('text golden', () => {
  it('every key reads the same line in every language', () => {
    const was = i18n.language;
    const hashes = Object.fromEntries(i18n.languages.map(l => [l.code, languageHash(l.code)]));
    i18n.setLanguage(was);

    expect(KEYS.length).toBe(2660);
    expect(hashes).toEqual({
      en: '465c1c8423b86148',
      bg: '8758f1808307ba5e',
      zh: '7c1856a4ce3edca4',
      fr: 'dbb27db2095bafd6',
      de: '814441bddbffdf34',
      it: '9b49ee0b7b06b6e1',
      ja: '9e297a2acab8269e',
      ko: '5fc34ec7eb468811',
      pl: 'b6fa85da034486fe',
      pt: '24b7eff74bc2ae18',
      ro: 'edad4f84464de053',
      ru: '1b755b8c5e75bb34',
      es: '9e4950a9afc1c978',
      th: '26d8e94849abb4ea',
      vi: 'af9c880eb0f89ee2',
      ar: '5f227398ecbb6934',
      bn: '57f3f04f90069205',
      ca: 'fd9e1bd3979397bf',
      cs: '772a178af7ddd4e6',
      el: 'c3d0669e26776c8f',
      eu: '12e77f2adb1a845e',
      fa: 'd5b9129087dc70f2',
      fil: '5bbc19e1f377423c',
      hi: '65c5f3b547106b68',
      hu: 'd035b8b57c0c3e29',
      id: '261199abdf83996e',
      'sr-Latn': 'eb3b386c6de2dbfc',
      tr: '994bb136fe13d361',
      uk: '97123274204d28d5',
      ur: '23cfe082287615a9',
      'zh-Hant': '48f37d2960948c06',
    });
  });
});
