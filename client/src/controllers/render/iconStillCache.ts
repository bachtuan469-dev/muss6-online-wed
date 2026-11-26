/**
 * The drawn item pictures kept across sessions (slice 3 of the glow-097 fix): a still is drawn
 * once per build and read back from Cache Storage on the next visit, so opening a shop after a
 * reload does not draw its icons again. The 0.97 WASM client keeps its whole 219 MB package in
 * Cache Storage across sessions the same way; ours keeps only the pictures, a few KB each.
 *
 * One cache per build id (`mu-item-icons-<build>`): a still drawn by another build is never read,
 * because the glow and sheen that went into it may have changed. Old builds' caches are pruned
 * when the store is made. Everything fails open: no Cache Storage, a quota error or a private
 * tab just means the picture is drawn again, as before.
 *
 * A still also depends on the item-effects options (`itemEffectSignature`): when those change,
 * `iconShots(scene).forget()` clears this store too, so a picture drawn with the old options is
 * never read back. A save that was already in flight when the clear landed is dropped by the
 * generation check, so it cannot put the stale picture back.
 */

const buildId = (): string => (typeof BUILD_ID === 'string' ? BUILD_ID : 'dev');

/** What a shot queue keeps its drawn pictures in across sessions: load by look key, save a drawn URL, clear all. */
export type IconStillStore = {
  load(key: string): Promise<string | null>;
  save(key: string, url: string): Promise<void>;
  clear(): void;
};

/** Cache Storage cache per build: a still drawn by another build is never read. */
export function iconStillCacheName(build: string): string {
  return `mu-item-icons-${build}`;
}

/** The request a look is stored under: a stable address, never fetched over the network. */
function stillRequest(key: string): Request {
  return new Request(`https://item-icons.invalid/${encodeURIComponent(key)}`);
}

/** The stills in Cache Storage, under a cache per build id. See the header. */
export class CacheStorageStillStore implements IconStillStore {
  private readonly name: string;
  private generation = 0;
  private pruned = false;
  private warned = false;

  constructor(build: string = buildId()) {
    this.name = iconStillCacheName(build);
    void this.pruneOldBuilds();
  }

  async load(key: string): Promise<string | null> {
    try {
      if (typeof caches === 'undefined') return null;
      const hit = await (await caches.open(this.name)).match(stillRequest(key));
      if (!hit) return null;
      return URL.createObjectURL(await hit.blob());
    } catch {
      return null;
    }
  }

  async save(key: string, url: string): Promise<void> {
    const generation = this.generation;
    try {
      if (typeof caches === 'undefined') return;
      const blob = await (await fetch(url)).blob();
      // Cleared since the draw finished: a stale still must not come back.
      if (generation !== this.generation) return;
      const cache = await caches.open(this.name);
      if (generation !== this.generation) return;
      await cache.put(stillRequest(key), new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
    } catch (error) {
      // Quota or a private tab: the still is dropped, the game draws it again next time.
      // One line, once: a full cache would otherwise log on every picture.
      if (!this.warned) {
        this.warned = true;
        console.warn('Item icon still could not be kept across sessions:', error);
      }
    }
  }

  clear(): void {
    this.generation++;
    if (typeof caches === 'undefined') return;
    void caches.delete(this.name).catch(() => {});
  }

  /** Drops other builds' still caches, once; the asset worker's cache is never touched. */
  private async pruneOldBuilds(): Promise<void> {
    if (this.pruned) return;
    this.pruned = true;
    try {
      if (typeof caches === 'undefined') return;
      for (const name of await caches.keys()) {
        if (name.startsWith('mu-item-icons-') && name !== this.name) await caches.delete(name);
      }
    } catch {
      // A cache that cannot be listed stays: the next build prunes it, or it ages out.
    }
  }
}
