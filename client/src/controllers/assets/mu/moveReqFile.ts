import { convertBux } from '../../terrain/mapFileEncryption';
import { onLanguageChanged } from '@/i18n';
import { decodeLocalText, downloadLocalDataFile } from './localData';

/**
 * `Local/<lang>/MoveReq_<lang>.bmd`, the Move window rows, decoded like
 * `CMoveCommandData::Create` (MoveCommandData.cpp:37). See assets/readme.md.
 */

const FILE = 'MoveReq';
const RECORD_SIZE = 84;
const NAME_LENGTH = 32;

export type MoveReqEntry = {
  /** `MOVEREQINFO.index` - what `WarpCommandRequest.WarpInfoIndex` carries. */
  index: number;
  /** `szMainMapName`: the name printed in the window. */
  name: string;
  /** `szSubMapName`: the `/move` alias. */
  alias: string;
  /** `iReqLevel`, before the class reduction. */
  reqLevel: number;
  /** `m_iReqMaxLevel`: kept for completeness; neither the S6 window nor OpenMU enforces it. */
  reqMaxLevel: number;
  /** `iReqZen`. */
  zen: number;
  /** `iGateNum`. */
  gate: number;
};

let pending: Promise<readonly MoveReqEntry[]> | null = null;

function readName(bytes: Uint8Array, offset: number): string {
  return decodeLocalText(bytes, offset, NAME_LENGTH);
}

/**
 * The English file's names are the original's internal spellings
 * (`LostTower`, `Dungeon2`); the server spells them with spaces. The
 * alias is left byte-identical: it is what `/move` matches.
 */
export function prettifyMapName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2');
}

/** Decodes one `MoveReq_<lang>.bmd` buffer. Exported for tests. */
export function parse(bytes: Uint8Array): MoveReqEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getInt32(0, true);
  const entries: MoveReqEntry[] = [];

  for (let i = 0; i < count; i++) {
    const offset = 4 + i * RECORD_SIZE;
    if (offset + RECORD_SIZE > bytes.length) break;

    const record = bytes.subarray(offset, offset + RECORD_SIZE);
    convertBux(record, RECORD_SIZE);

    entries.push({
      index: view.getInt32(offset, true),
      name: prettifyMapName(readName(bytes, offset + 4)),
      alias: readName(bytes, offset + 4 + NAME_LENGTH),
      reqLevel: view.getInt32(offset + 68, true),
      reqMaxLevel: view.getInt32(offset + 72, true),
      zen: view.getInt32(offset + 76, true),
      gate: view.getInt32(offset + 80, true),
    });
  }

  return entries;
}

/** The move list, in file order (the order the window shows). Cached after the first call. */
export function loadMoveReqList(): Promise<readonly MoveReqEntry[]> {
  if (!pending) {
    // FIX26 Viec 2: map names stay in English, in every UI language - the
    // list is read from `MoveReq_eng.bmd`, never from the language pack.
    pending = downloadLocalDataFile(FILE, undefined, true).then(parse, err => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

// The map names come out of the language pack, so a language change has to
// drop the cache; the window re-reads on its next open.
onLanguageChanged(() => {
  pending = null;
});
