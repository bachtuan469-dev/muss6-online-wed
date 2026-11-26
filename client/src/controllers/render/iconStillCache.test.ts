import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheStorageStillStore, iconStillCacheName } from './iconStillCache';

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
};

/** An in-memory Cache Storage: one Map of request URL to Response per cache name. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const caches = {
    stores,
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async match(request: Request) {
          return store.get(request.url);
        },
        async put(request: Request, response: Response) {
          store.set(request.url, response);
        },
        async keys() {
          return [...store.keys()].map(url => new Request(url));
        },
        async delete(request: Request) {
          return store.delete(request.url);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  return caches;
}

type FakeCaches = ReturnType<typeof fakeCaches>;

const g = globalThis as Record<string, unknown>;
const realCaches = g.caches;
const realFetch = g.fetch;

beforeEach(() => {
  g.caches = fakeCaches();
});

afterEach(() => {
  g.caches = realCaches;
  g.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('the still cache name', () => {
  it('is one cache per build, and never under the asset worker’s prefix', () => {
    expect(iconStillCacheName('mwx0z2t8')).toBe('mu-item-icons-mwx0z2t8');
    // public/sw.js deletes every mu-assets-* cache but its own on activate.
    expect(iconStillCacheName('mwx0z2t8').startsWith('mu-assets-')).toBe(false);
  });
});

describe('the Cache Storage still store', () => {
  it('keeps a drawn picture and hands it back as an object URL', async () => {
    const store = new CacheStorageStillStore('test-build');
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    g.fetch = vi.fn(async () => new Response(blob));
    await store.save('12_26_0', url);
    const loaded = await store.load('12_26_0');
    expect(loaded).not.toBeNull();
    expect(await (await fetch(loaded!)).text()).toBe('png-bytes');
    URL.revokeObjectURL(url);
    if (loaded) URL.revokeObjectURL(loaded);
  });

  it('answers null on a miss, and with no Cache Storage at all', async () => {
    const store = new CacheStorageStillStore('test-build');
    expect(await store.load('12_26_0')).toBeNull();
    g.caches = undefined;
    expect(await store.load('12_26_0')).toBeNull();
    await store.save('12_26_0', 'blob:x');
    store.clear();
  });

  it('fails open when the put hits quota', async () => {
    const caches = g.caches as FakeCaches;
    const store = new CacheStorageStillStore('test-build');
    g.fetch = vi.fn(async () => new Response(new Blob(['png-bytes'])));
    const open = caches.open.bind(caches);
    caches.open = async (name: string) => {
      const cache = await open(name);
      cache.put = async () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
      return cache;
    };
    await expect(store.save('12_26_0', 'blob:x')).resolves.toBeUndefined();
    expect(await store.load('12_26_0')).toBeNull();
  });

  it('drops the whole cache on clear, and a save in flight does not come back', async () => {
    const caches = g.caches as FakeCaches;
    const store = new CacheStorageStillStore('test-build');
    let release!: (blob: Blob) => void;
    const fetched = new Promise<Blob>(resolve => {
      release = resolve;
    });
    g.fetch = vi.fn(async () => new Response(await fetched));
    const saving = store.save('12_26_0', 'blob:x');
    store.clear();
    release(new Blob(['png-bytes']));
    await saving;
    await settle();
    expect(await caches.keys()).not.toContain(iconStillCacheName('test-build'));
    const reopened = await caches.open(iconStillCacheName('test-build'));
    expect(await reopened.match(new Request('https://item-icons.invalid/12_26_0'))).toBeUndefined();
  });

  it('prunes other builds’ still caches and leaves the rest alone', async () => {
    const caches = g.caches as FakeCaches;
    await (await caches.open(iconStillCacheName('old-build'))).put(
      new Request('https://item-icons.invalid/12_26_0'),
      new Response(new Blob(['png-bytes']))
    );
    await caches.open('mu-assets-v1');
    await caches.open('mu-modules');
    new CacheStorageStillStore('test-build');
    await settle();
    expect(await caches.keys()).toEqual(expect.arrayContaining(['mu-assets-v1', 'mu-modules']));
    expect(await caches.keys()).not.toContain(iconStillCacheName('old-build'));
  });
});
