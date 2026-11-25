import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const files = new Map<string, Uint8Array>();
vi.mock('./dataFolder', () => ({
  hasDataFile: () => true,
  downloadDataFile: async (path: string) => files.get(path) ?? new Uint8Array(),
}));

const { loadMuSprite } = await import('./sprites');

/** A WebP behind an OZJ (24 bytes) or OZT (4 bytes) header, as `tools/liteAssets.ts` writes the copies. */
async function copy(head: number, width: number, height: number): Promise<Uint8Array> {
  const webp = await sharp(Buffer.alloc(width * height * 4, 120), { raw: { width, height, channels: 4 } }).webp().toBuffer();
  const out = new Uint8Array(head + webp.length);
  out.set(new Uint8Array(webp), head);
  return out;
}

describe('loadMuSprite on a lighter copy', () => {
  it('takes the WebP behind either header as it is', async () => {
    files.set('Interface/a.OZJ', await copy(24, 30, 12));
    files.set('Interface/b.OZT', await copy(4, 16, 40));

    expect(await loadMuSprite('Interface/a.OZJ')).toMatchObject({ width: 30, height: 12 });
    expect(await loadMuSprite('Interface/b.OZT')).toMatchObject({ width: 16, height: 40 });
  });
});

/** A raw TGA (type 2, 32bpp, top-left origin) behind the 4-byte OZT header, as the original ships. */
function ozt(width: number, height: number): Uint8Array {
  const tga = new Uint8Array(18 + width * height * 4);
  tga[2] = 2;
  const view = new DataView(tga.buffer);
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  tga[16] = 32;
  tga[17] = 0x20;
  tga.fill(255, 18);
  const out = new Uint8Array(4 + tga.length);
  out.set(tga, 4);
  return out;
}

/** A canvas whose encoder answers per type; every type asked for lands in `asked`. */
function fakeCanvas(answers: Record<string, Blob | null>, asked: string[]) {
  return {
    width: 0,
    height: 0,
    getContext: () => ({ putImageData: () => {} }),
    toBlob: (cb: (blob: Blob | null) => void, type: string) => {
      asked.push(type);
      cb(answers[type] ?? null);
    },
  };
}

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number
  ) {}
}

describe('loadMuSprite on an original OZT', () => {
  const asked: string[] = [];

  function stubCanvas(answers: Record<string, Blob | null>) {
    asked.length = 0;
    vi.stubGlobal('ImageData', FakeImageData);
    vi.stubGlobal('document', { createElement: () => fakeCanvas(answers, asked) });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('takes the WebP the canvas encodes', async () => {
    stubCanvas({ 'image/webp': new Blob([new Uint8Array(8)], { type: 'image/webp' }) });
    files.set('Interface/webp.OZT', ozt(3, 2));

    expect(await loadMuSprite('Interface/webp.OZT')).toMatchObject({ width: 3, height: 2 });
    expect(asked).toEqual(['image/webp']);
  });

  it('falls back to PNG when the canvas cannot encode WebP', async () => {
    stubCanvas({
      'image/webp': null,
      'image/png': new Blob([new Uint8Array(8)], { type: 'image/png' }),
    });
    files.set('Interface/png.OZT', ozt(2, 2));

    expect(await loadMuSprite('Interface/png.OZT')).toMatchObject({ width: 2, height: 2 });
    expect(asked).toEqual(['image/webp', 'image/png']);
  });

  it('fails when the canvas encodes nothing at all', async () => {
    stubCanvas({});
    files.set('Interface/none.OZT', ozt(2, 2));

    await expect(loadMuSprite('Interface/none.OZT')).rejects.toThrow('Could not encode');
  });
});
