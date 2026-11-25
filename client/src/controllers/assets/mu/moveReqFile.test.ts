import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import { localDataCandidates } from './localData';
import { prettifyMapName } from './moveReqFile';

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
});
