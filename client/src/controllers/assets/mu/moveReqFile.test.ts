import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { i18n } from '@/i18n';
import { localDataCandidates } from './localData';
import { parse, prettifyMapName } from './moveReqFile';

describe('moveReqFile (FIX26 Viec 2)', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('spells the English map names the way the server does', () => {
    expect(prettifyMapName('LostTower')).toBe('Lost Tower');
    expect(prettifyMapName('Dungeon2')).toBe('Dungeon 2');
    expect(prettifyMapName('KanturuRuins1')).toBe('Kanturu Ruins 1');
    expect(prettifyMapName('PeaceSwamp')).toBe('Peace Swamp');
    expect(prettifyMapName('LaCleon')).toBe('La Cleon');
    expect(prettifyMapName('Devias')).toBe('Devias');
    expect(prettifyMapName('Atlans')).toBe('Atlans');
    expect(prettifyMapName('Vulcanus')).toBe('Vulcanus');
  });

  it('reads the move list from the English pack in every language', () => {
    i18n.setLanguage('vi');
    expect(localDataCandidates('MoveReq', undefined, true)).toEqual([
      'Local/Eng/MoveReq_eng.bmd',
      'Local/Eng/movereq_eng.bmd',
    ]);
    // Without the flag the Vietnamese pack wins.
    expect(localDataCandidates('MoveReq')[0]).toBe('Local/Vie/MoveReq_vie.bmd');
  });

  it('lists Crywolf and Barracks (server-added rows, 2026-11-26)', () => {
    // The classic file ships 37 rows and no Crywolf/Barracks; the server
    // owner added both so the Move window can warp there. The file reserves
    // 50 slots, so the rows sit in the first two empty slots, size unchanged.
    const file = fileURLToPath(
      new URL('../../../../Data/Local/Eng/MoveReq_eng.bmd', import.meta.url),
    );
    const entries = parse(new Uint8Array(readFileSync(file)));
    expect(entries).toHaveLength(39);
    const byIndex = new Map(entries.map(e => [e.index, e]));
    expect(byIndex.size).toBe(entries.length);
    const crywolf = byIndex.get(26);
    expect(crywolf).toMatchObject({
      name: 'Crywolf',
      alias: 'Crywolf',
      reqLevel: 190,
      reqMaxLevel: 400,
      zen: 10000,
    });
    const barracks = byIndex.get(24);
    expect(barracks).toMatchObject({
      name: 'Barracks of Balgass',
      alias: 'Barracks',
      reqLevel: 220,
      reqMaxLevel: 400,
      zen: 100000,
    });
  });
});
