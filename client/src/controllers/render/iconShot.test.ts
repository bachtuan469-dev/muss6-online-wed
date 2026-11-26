import { afterAll, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { BlendState } from '@versions/shared/objects/enum';
import { getMaterial } from '../assets/modelLoader';
import { ICON_LAYER, compositeOver, createIconShots, iconHaloLayer, iconPixels, type IconHalo, type IconShotJob, type IconShotsOptions } from './iconShot';
import type { IconStillStore } from './iconStillCache';

vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.location ??= { href: 'http://localhost/', search: '', hostname: 'localhost', protocol: 'http:' };
});

const engine = new NullEngine();
const scene = new Scene(engine);
const main = new FreeCamera('main', new Vector3(0, 5, -10), scene);
scene.activeCamera = main;
afterAll(() => engine.dispose());

/** The frames the queue gets: one draw each, the promises between them settled. */
async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    scene.render();
    for (let k = 0; k < 5; k++) await Promise.resolve();
    // And a macrotask: Babylon imports a material's shader source on its first compile.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** Frames until the shot is in: how many microtask hops its async steps take differs between node versions. */
async function shot<T>(done: Promise<T>): Promise<T> {
  let settled = false;
  const settle = () => void (settled = true);
  void done.then(settle, settle);
  // Past READY_FRAMES times READY_ATTEMPTS, the shot draws even if the shaders never got ready.
  for (let i = 0; i < 400 && !settled; i++) await frames(1);
  return done;
}

const VIEW = { width: 4, height: 2, left: 0, right: 0.4, bottom: -0.2, top: 0 };

/** A job whose subject is one box under the shot's root; `disposed` counts its dispose. */
function boxJob(key: string, log: { built: string[]; disposed: string[] }): IconShotJob {
  return {
    key,
    view: VIEW,
    build: async (root: TransformNode) => {
      log.built.push(key);
      const box = CreateBox(key, { size: 0.1 }, scene);
      box.parent = root;
      box.position.set(0.2, 2, -0.1);
      return { dispose: () => { log.disposed.push(key); box.dispose(); } };
    },
  };
}

function shots(options: IconShotsOptions = {}) {
  const read = vi.fn(async (_rtt: RenderTargetTexture, view: typeof VIEW) => new Uint8Array(view.width * view.height * 4));
  const encode = vi.fn(async (_pixels: Uint8ClampedArray, w: number, h: number) => `blob:${w}x${h}`);
  const readNow = vi.fn((_rtt: RenderTargetTexture, _view: typeof VIEW, out: Uint8Array) => void out.fill(255));
  return { shots: createIconShots(scene, { read, encode, readNow }, options), read, encode, readNow };
}

/** A still store held in memory: what the shot queue keeps across sessions. */
function memoryStillStore() {
  const saved = new Map<string, string>();
  let cleared = 0;
  const store: IconStillStore = {
    load: async key => saved.get(key) ?? null,
    save: async (key, url) => { saved.set(key, url); },
    clear: () => { cleared++; saved.clear(); },
  };
  return { store, saved, cleared: () => cleared };
}

describe('the one-shot icon render', () => {
  it('draws at most one icon per frame, and nothing once the queue is empty', async () => {
    const draws = vi.spyOn(RenderTargetTexture.prototype, 'render');
    const log = { built: [] as string[], disposed: [] as string[] };
    const idle = scene.onAfterRenderObservable.observers.length;
    const { shots: s } = shots();
    const a = s.shoot(boxJob('a', log));
    const b = s.shoot(boxJob('b', log));
    const perFrame: number[] = [];
    for (let i = 0; i < 8; i++) {
      const before = draws.mock.calls.length;
      await frames(1);
      perFrame.push(draws.mock.calls.length - before);
    }
    expect(await a).toBe('blob:4x2');
    expect(await b).toBe('blob:4x2');
    expect(Math.max(...perFrame)).toBe(1);
    expect(draws.mock.calls.length).toBe(2);
    await frames(3);
    expect(draws.mock.calls.length).toBe(2);
    // Babylon drops a removed observer on the next task.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(scene.onAfterRenderObservable.observers.length).toBe(idle);
    draws.mockRestore();
  });

  it('builds and draws each key once and hands the same URL back', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s, read } = shots();
    const first = s.shoot(boxJob('same', log));
    const second = s.shoot(boxJob('same', log));
    expect(second).toBe(first);
    expect(await shot(first)).toBe('blob:4x2');
    expect(s.shoot(boxJob('same', log))).toBe(first);
    expect(log.built).toEqual(['same']);
    expect(read).toHaveBeenCalledTimes(1);
  });

  // Slice 2 of the glow-097 fix: a still's meshes are flagged so the item
  // material gives their sheen a floor on dark texels (FX_ICON_STILL); the
  // flag is set here, in the shot's prepare, and nowhere else.
  it('flags the shot meshes as a still, for the still-only sheen floor', async () => {
    const seen: unknown[] = [];
    const render = vi.spyOn(RenderTargetTexture.prototype, 'render').mockImplementation(function (this: RenderTargetTexture) {
      seen.push((this.renderList ?? [])[0].metadata.iconStill);
    });
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const done = s.shoot(boxJob('still-flag', log));
    await shot(done);
    render.mockRestore();
    expect(seen).toEqual([true]);
  });

  it('draws a key again once its pictures are forgotten (a changed item-effects option)', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const first = s.shoot(boxJob('again', log));
    await shot(first);
    s.forget();
    const second = s.shoot(boxJob('again', log));
    expect(second).not.toBe(first);
    expect(await shot(second)).toBe('blob:4x2');
    expect(log.built).toEqual(['again', 'again']);
  });

  it('frees the subject, its root, the camera and the target after the shot', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const cameras = scene.cameras.length;
    const nodes = scene.transformNodes.length;
    const textures = scene.textures.length;
    const { shots: s } = shots();
    const done = s.shoot(boxJob('freed', log));
    await shot(done);
    expect(log.disposed).toEqual(['freed']);
    expect(scene.cameras.length).toBe(cameras);
    expect(scene.transformNodes.length).toBe(nodes);
    expect(scene.textures.length).toBe(textures);
    expect(scene.getMeshByName('freed')).toBeNull();
  });

  it('keeps the subject out of the main camera and frames the view with its own', async () => {
    const seen: { mask: number; main: boolean; ortho: (number | null)[]; layer: number }[] = [];
    const render = vi.spyOn(RenderTargetTexture.prototype, 'render').mockImplementation(function (this: RenderTargetTexture) {
      const cam = this.activeCamera as Camera;
      const mesh = (this.renderList ?? [])[0];
      seen.push({
        mask: mesh.layerMask,
        main: (mesh.layerMask & main.layerMask) !== 0,
        ortho: [cam.orthoLeft, cam.orthoRight, cam.orthoBottom, cam.orthoTop],
        layer: cam.layerMask,
      });
    });
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const done = s.shoot(boxJob('framed', log));
    await shot(done);
    render.mockRestore();
    expect(seen).toEqual([{ mask: ICON_LAYER, main: false, ortho: [0, 0.4, -0.2, 0], layer: ICON_LAYER }]);
  });

  it('draws by its own light: flat lit at BodyLight 1, out of the fog and the shadow passes', async () => {
    const lit = getMaterial(scene, true, 0, BlendState.ALPHA_DISABLE);
    const bright = getMaterial(scene, false, 2, BlendState.ALPHA_ONEOE, true);
    const seen: { flat: boolean; brightKept: boolean; light: number[]; fog: boolean; caster: boolean }[] = [];
    const render = vi.spyOn(RenderTargetTexture.prototype, 'render').mockImplementation(function (this: RenderTargetTexture) {
      const [body, card] = this.renderList ?? [];
      seen.push({
        flat: body.material !== lit && !!body.material?.name.includes('_flat'),
        brightKept: card.material === bright,
        light: [body.metadata.bodyLight.x, body.metadata.bodyLight.y, body.metadata.bodyLight.z],
        fog: body.applyFog,
        caster: body.metadata.csmCaster,
      });
    });
    const { shots: s } = shots();
    const done = s.shoot({
      key: 'lit',
      view: VIEW,
      build: async root => {
        const body = CreateBox('body', { size: 0.1 }, scene);
        const card = CreateBox('card', { size: 0.1 }, scene);
        body.material = lit;
        card.material = bright;
        body.metadata = { bodyLight: new Vector3(0.3, 0.3, 0.3), csmCaster: true };
        card.metadata = { brightMesh: true };
        body.parent = root;
        card.parent = root;
        return { dispose: () => { body.dispose(); card.dispose(); } };
      },
    });
    await shot(done);
    render.mockRestore();
    expect(seen).toEqual([{ flat: true, brightKept: true, light: [1, 1, 1], fog: false, caster: false }]);
  });

  // RenderPartObjectBody sets a seed's BodyLight to its colour over the bag's 1, 1, 1 (ZzzObject.cpp:8067-8090).
  it('keeps the light of a mesh lit by its own shine', async () => {
    const colour = new Vector3(0.9, 0.1, 0.2);
    const seen: unknown[] = [];
    const render = vi.spyOn(RenderTargetTexture.prototype, 'render').mockImplementation(function (this: RenderTargetTexture) {
      seen.push((this.renderList ?? [])[0].metadata.bodyLight);
    });
    const { shots: s } = shots();
    const done = s.shoot({
      key: 'seed',
      view: VIEW,
      build: async root => {
        const seed = CreateBox('seed', { size: 0.1 }, scene);
        seed.metadata = { bodyLight: colour, shineLit: true };
        seed.parent = root;
        return { dispose: () => seed.dispose() };
      },
    });
    await shot(done);
    render.mockRestore();
    expect(seen).toEqual([colour]);
  });

  it('answers null when the subject cannot be built, and goes on with the next', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const broken = s.shoot({ key: 'broken', view: VIEW, build: async () => { throw new Error('no model'); } });
    const none = s.shoot({ key: 'none', view: VIEW, build: async () => null });
    const next = s.shoot(boxJob('next', log));
    await frames(6);
    expect(await broken).toBeNull();
    expect(await none).toBeNull();
    expect(await next).toBe('blob:4x2');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('waits for the subject to be ready, a bounded number of frames', async () => {
    const ready = vi.spyOn(RenderTargetTexture.prototype, 'isReadyForRendering').mockReturnValue(false);
    const draws = vi.spyOn(RenderTargetTexture.prototype, 'render');
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const done = s.shoot(boxJob('slow', log));
    await frames(10);
    expect(draws).not.toHaveBeenCalled();
    // One round of READY_FRAMES is not enough to draw it colourless: the
    // shot waits again for the textures instead of caching a blank picture.
    await frames(150);
    expect(draws).not.toHaveBeenCalled();
    // Once the subject is ready the shot draws, so a slow texture cannot
    // stall the queue for good.
    ready.mockReturnValue(true);
    await frames(5);
    expect(await done).toBe('blob:4x2');
    expect(draws).toHaveBeenCalledTimes(1);
    ready.mockRestore();
    draws.mockRestore();
  }, 30000);

  it('does not draw a colourless picture while a texture is still arriving', async () => {
    const draws = vi.spyOn(RenderTargetTexture.prototype, 'render');
    const { shots: s } = shots();
    let textureReady = false;
    const done = s.shoot({
      key: 'textured',
      view: VIEW,
      build: async root => {
        const box = CreateBox('textured', { size: 0.1 }, scene);
        box.metadata = { diffuseTexture: { isReady: () => textureReady } };
        box.parent = root;
        return { dispose: () => box.dispose() };
      },
    });
    await frames(10);
    expect(draws).not.toHaveBeenCalled();
    // Past one round of READY_FRAMES the texture still has not arrived: the
    // shot waits again instead of caching a colourless picture.
    await frames(150);
    expect(draws).not.toHaveBeenCalled();
    // The texture arrives: the next frame draws it, coloured.
    textureReady = true;
    await frames(5);
    expect(await done).toBe('blob:4x2');
    expect(draws).toHaveBeenCalledTimes(1);
    draws.mockRestore();
  }, 30000);
});

// Slice 3 of the glow-097 fix: a drawn still is kept across sessions, so opening a shop after a
// reload reads its pictures back instead of drawing them again.
describe('the stills kept across sessions', () => {
  it('reads a kept still back without building or drawing', async () => {
    const { store, saved } = memoryStillStore();
    saved.set('kept', 'blob:kept');
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots({ persistent: store });
    expect(await s.shoot(boxJob('kept', log))).toBe('blob:kept');
    expect(log.built).toEqual([]);
  });

  it('keeps a drawn picture, and a new queue reads it without building', async () => {
    const { store, saved } = memoryStillStore();
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots({ persistent: store });
    expect(await shot(s.shoot(boxJob('drawn', log)))).toBe('blob:4x2');
    expect(saved.get('drawn')).toBe('blob:4x2');
    const next = { built: [] as string[], disposed: [] as string[] };
    const { shots: s2 } = shots({ persistent: store });
    expect(await s2.shoot(boxJob('drawn', next))).toBe('blob:4x2');
    expect(next.built).toEqual([]);
  });

  it('drops the kept pictures on forget, and draws them again after', async () => {
    const { store, saved, cleared } = memoryStillStore();
    saved.set('kept', 'blob:kept');
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots({ persistent: store });
    expect(await s.shoot(boxJob('kept', log))).toBe('blob:kept');
    s.forget();
    expect(cleared()).toBe(1);
    expect(saved.size).toBe(0);
    expect(await shot(s.shoot(boxJob('kept', log)))).toBe('blob:4x2');
    expect(log.built).toEqual(['kept']);
    expect(saved.get('kept')).toBe('blob:4x2');
  });

  it('keeps no picture for a look that cannot be drawn', async () => {
    const { store, saved } = memoryStillStore();
    const { shots: s } = shots({ persistent: store });
    const done = s.shoot({ key: 'none', view: VIEW, build: async () => null });
    expect(await shot(done)).toBeNull();
    expect(saved.has('none')).toBe(false);
  });

  it('draws as before when the kept store fails', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const broken: IconStillStore = {
      load: async () => { throw new Error('no cache'); },
      save: async () => { throw new Error('no cache'); },
      clear: () => { throw new Error('no cache'); },
    };
    const { shots: s } = shots({ persistent: broken });
    expect(await shot(s.shoot(boxJob('drawn', log)))).toBe('blob:4x2');
    expect(log.built).toEqual(['drawn']);
  });
});

// `if (1 == Select) ObjectSelect.Angle[1] = WorldTime * 0.45f` (ZzzInventory.cpp:8856-8859): the item under the
// cursor turns every frame.
describe('the hover spin', () => {
  /** A box job that records the times it is turned to. */
  function spinJob(key: string, log: { built: string[]; disposed: string[] }, turns: number[]): IconShotJob {
    return { ...boxJob(key, log), turn: ms => void turns.push(ms) };
  }

  it('draws one turned picture a frame into one kept buffer, and frees everything when stopped', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const turns: number[] = [];
    const painted: Uint8ClampedArray[] = [];
    const cameras = scene.cameras.length;
    const textures = scene.textures.length;
    // Babylon drops a removed observer on the next task: let the earlier tests' go first.
    await new Promise(resolve => setTimeout(resolve, 0));
    const idle = scene.onAfterRenderObservable.observers.length;
    const { shots: s, readNow } = shots();
    const stop = s.spin(spinJob('spin', log, turns), pixels => void painted.push(pixels));
    const perFrame: number[] = [];
    for (let i = 0; i < 12; i++) {
      const before = painted.length;
      await frames(1);
      perFrame.push(painted.length - before);
    }
    // Every frame once it is ready (the shaders may take a few), never twice in one.
    expect(Math.max(...perFrame)).toBe(1);
    expect(perFrame.slice(perFrame.indexOf(1))).not.toContain(0);
    expect(readNow).toHaveBeenCalledTimes(painted.length);
    expect(new Set(painted).size).toBe(1);
    expect(new Set(readNow.mock.calls.map(call => call[2])).size).toBe(1);
    expect(turns).toHaveLength(painted.length);
    expect([...turns].sort((a, b) => a - b)).toEqual(turns);
    // The read is turned into straight alpha, top-down, as the still picture is.
    expect([...painted[0].subarray(0, 4)]).toEqual([255, 255, 255, 255]);

    stop();
    const drawn = painted.length;
    await frames(3);
    expect(painted).toHaveLength(drawn);
    expect(log.disposed).toEqual(['spin']);
    expect(scene.cameras.length).toBe(cameras);
    expect(scene.textures.length).toBe(textures);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(scene.onAfterRenderObservable.observers.length).toBe(idle);
  });

  it('spins one item at a time', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const first: Uint8ClampedArray[] = [];
    const second: Uint8ClampedArray[] = [];
    s.spin(spinJob('first', log, []), pixels => void first.push(pixels));
    await frames(4);
    const stop = s.spin(spinJob('second', log, []), pixels => void second.push(pixels));
    const firstDrawn = first.length;
    await frames(8);
    expect(first).toHaveLength(firstDrawn);
    expect(second.length).toBeGreaterThan(0);
    expect(log.disposed).toEqual(['first']);
    stop();
    expect(log.disposed).toEqual(['first', 'second']);
  });

  it('draws nothing and keeps nothing when stopped before its model is in', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const nodes = scene.transformNodes.length;
    const { shots: s } = shots();
    const painted: Uint8ClampedArray[] = [];
    s.spin(spinJob('early', log, []), pixels => void painted.push(pixels))();
    await frames(3);
    expect(painted).toEqual([]);
    expect(log.disposed).toEqual(['early']);
    expect(scene.transformNodes.length).toBe(nodes);
  });
});

describe('iconPixels', () => {
  it('turns the bottom-up read into top-down rows', () => {
    // 1 x 2: bottom row red, top row green, both opaque.
    const read = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    expect([...iconPixels(read, 1, 2, false)]).toEqual([0, 255, 0, 255, 255, 0, 0, 255]);
  });

  it('gives an additive glow over the clear its own alpha, so it shows over a dark bag', () => {
    // Additive drew colour and left the cleared alpha at 0; the blended pixel is premultiplied.
    const read = new Uint8Array([200, 100, 0, 0, 64, 32, 0, 128]);
    expect([...iconPixels(read, 2, 1, false)]).toEqual([255, 128, 0, 200, 128, 64, 0, 128]);
  });

  it('rewrites a kept buffer whole, the cleared pixels too', () => {
    const out = new Uint8ClampedArray(8).fill(9);
    expect(iconPixels(new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]), 2, 1, false, out)).toBe(out);
    expect([...out]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);
  });

  it('encodes a linear frame buffer to the display curve first', () => {
    const read = new Uint8Array([0, 0, 0, 255, 55, 55, 55, 255]);
    const out = iconPixels(read, 2, 1, true);
    expect(out[0]).toBe(0);
    // (55 / 255) ^ (1 / 2.2) = 0.497
    expect(out[4]).toBe(127);
    expect(out[7]).toBe(255);
  });
});

// The live still reads flat next to the pack picture (user photo 2026-11-26): the pack's glow is
// its bright surface, and the live surface at the capped halo ladder cannot be raised without the
// burnt blob coming back. So the still bakes the item's halo colour into the picture itself: a
// blurred aura from the silhouette's own alpha, under the item, in the tier's colour.
describe('the baked icon halo', () => {
  const ORANGE: IconHalo = { r: 1, g: 0.5, b: 0 };

  /** A straight-alpha picture, `w` x `h`, with one opaque block; the rest clear. */
  function picture(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8ClampedArray {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * w + x) * 4;
        px[o] = 200;
        px[o + 1] = 100;
        px[o + 2] = 0;
        px[o + 3] = 255;
      }
    }
    return px;
  }

  it('spills the halo colour outside the silhouette and fades with distance', () => {
    const layer = iconHaloLayer(picture(12, 12, 5, 5, 7, 7), 12, 12, ORANGE);
    const at = (x: number, y: number): [number, number, number, number] => {
      const o = (y * 12 + x) * 4;
      return [layer[o], layer[o + 1], layer[o + 2], layer[o + 3]];
    };
    // Just outside the block: the aura is there, in the halo colour.
    const near = at(7, 6);
    expect(near[3]).toBeGreaterThan(0);
    expect(near[0]).toBeGreaterThan(near[1]);
    expect(near[1]).toBeGreaterThan(near[2]);
    // A corner far from the block: nothing spills that far.
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
    // The falloff is smooth: nearer is stronger than further.
    expect(at(7, 6)[3]).toBeGreaterThan(at(9, 6)[3]);
  });

  it('is nothing when the item has no glow colour', () => {
    const layer = iconHaloLayer(picture(12, 12, 5, 5, 7, 7), 12, 12, { r: 0, g: 0, b: 0 });
    expect([...layer].every(v => v === 0)).toBe(true);
  });

  // Slice 2 of the glow-097 fix: the baked aura is wider than the world's
  // (spread 1/8 of the short side, not 1/12), so it still reads at icon size.
  // On a 40 px picture the radius is 5, two passes reach 10 px out: 8 px
  // from the block edge the aura is there, while the far corner stays clear.
  it('spreads wider than the world halo: 8 px out on a 40 px picture', () => {
    const layer = iconHaloLayer(picture(40, 40, 18, 18, 22, 22), 40, 40, ORANGE);
    const at = (x: number, y: number): [number, number, number, number] => {
      const o = (y * 40 + x) * 4;
      return [layer[o], layer[o + 1], layer[o + 2], layer[o + 3]];
    };
    const far = at(29, 20);
    expect(far[3]).toBeGreaterThan(0);
    expect(far[0]).toBeGreaterThan(far[1]);
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('draws the item over the aura without touching its opaque pixels', () => {
    const px = picture(12, 12, 5, 5, 7, 7);
    const layer = iconHaloLayer(px, 12, 12, ORANGE);
    const out = compositeOver(px, layer);
    expect(out).toBe(px);
    const at = (x: number, y: number): [number, number, number, number] => {
      const o = (y * 12 + x) * 4;
      return [out[o], out[o + 1], out[o + 2], out[o + 3]];
    };
    // The block itself is untouched.
    expect(at(5, 5)).toEqual([200, 100, 0, 255]);
    // The clear ground beside it now carries the aura.
    const near = at(7, 6);
    expect(near[3]).toBeGreaterThan(0);
    expect(near[0]).toBeGreaterThan(near[1]);
    // Far away stays clear.
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('blends a half-transparent item pixel over the aura', () => {
    const top = new Uint8ClampedArray([100, 0, 0, 128]);
    const bottom = new Uint8ClampedArray([0, 0, 200, 255]);
    const out = compositeOver(top, bottom);
    // Over: opaque, the red halved over the blue.
    expect([...out]).toEqual([50, 0, 100, 255]);
  });

  it('bakes the halo into a still when the job carries one, and not otherwise', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    // The read: a 4 x 2 picture, opaque red in the middle, clear at the corners.
    const read = vi.fn(async () => {
      const buf = new Uint8Array(4 * 2 * 4);
      for (let i = 0; i < 8; i++) buf[i * 4 + 3] = 255;
      buf[0 * 4] = 255;
      buf[1 * 4] = 255;
      buf[2 * 4] = 255;
      buf[3 * 4] = 255;
      buf[4 * 4 + 3] = 0;
      buf[5 * 4] = 255;
      buf[6 * 4] = 255;
      buf[7 * 4 + 3] = 0;
      return buf;
    });
    const encode = vi.fn(async (pixels: Uint8ClampedArray, w: number, h: number) => `blob:${w}x${h}`);
    const { shots: s } = { shots: createIconShots(scene, { read, encode, readNow: vi.fn() }) };
    const withHalo = s.shoot({ ...boxJob('haloed', log), halo: ORANGE });
    const plain = s.shoot({ ...boxJob('plain', log) });
    expect(await shot(withHalo)).toBe('blob:4x2');
    expect(await shot(plain)).toBe('blob:4x2');
    const haloPixels = encode.mock.calls[0][0] as Uint8ClampedArray;
    const plainPixels = encode.mock.calls[1][0] as Uint8ClampedArray;
    // A corner clear in the read now carries the orange aura...
    expect(haloPixels[3]).toBeGreaterThan(0);
    expect(haloPixels[0]).toBeGreaterThan(haloPixels[1]);
    // ...while the same corner stays clear without a halo, and the opaque
    // middle is the same red in both.
    expect(plainPixels[3]).toBe(0);
    expect([haloPixels[4], haloPixels[5], haloPixels[6], haloPixels[7]]).toEqual([255, 0, 0, 255]);
    expect([plainPixels[4], plainPixels[5], plainPixels[6], plainPixels[7]]).toEqual([255, 0, 0, 255]);
  }, 30000);

  it('keeps the halo under the turning picture, from the first frame on', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const painted: Uint8ClampedArray[] = [];
    // The read: the middle columns opaque white, the outer columns clear
    // (all four bytes zero: iconPixels takes alpha as the max of the four).
    const readNow = vi.fn((_rtt: RenderTargetTexture, _view: typeof VIEW, out: Uint8Array) => {
      for (let i = 0; i < 8; i++) {
        const opaque = i % 4 === 1 || i % 4 === 2;
        out[i * 4] = opaque ? 255 : 0;
        out[i * 4 + 1] = opaque ? 255 : 0;
        out[i * 4 + 2] = opaque ? 255 : 0;
        out[i * 4 + 3] = opaque ? 255 : 0;
      }
    });
    const { shots: s } = { shots: createIconShots(scene, { read: vi.fn(async () => new Uint8Array(32)), encode: vi.fn(async () => 'blob:x'), readNow }) };
    await new Promise(resolve => setTimeout(resolve, 0));
    const stop = s.spin({ ...boxJob('spin-halo', log), halo: ORANGE }, pixels => void painted.push(Uint8ClampedArray.from(pixels)));
    for (let i = 0; i < 8 && painted.length < 2; i++) await frames(1);
    stop();
    expect(painted.length).toBeGreaterThan(0);
    const first = painted[0];
    // A clear corner now carries the orange aura, the opaque middle stays white.
    expect(first[3]).toBeGreaterThan(0);
    expect(first[0]).toBeGreaterThan(first[1]);
    expect([first[4], first[5], first[6], first[7]]).toEqual([255, 255, 255, 255]);
    // The aura does not pile up frame on frame: the last frame's corner is
    // the same as the first's, because the layer is baked once.
    if (painted.length > 1) expect([...painted.at(-1)!.subarray(0, 4)]).toEqual([...first.subarray(0, 4)]);
  });
});

// A shop opens on a cold cache (user photo 2026-11-26: the grid stayed empty
// until the character was switched and re-entered, when the model caches were
// warm): one model fetch that never comes back must not stall the whole grid
// behind it, the models queued behind it are warmed in parallel while the
// queue draws one by one, and a picture that landed missing is drawn again
// on the next try instead of staying cached as nothing.
describe('the bounded queue', () => {
  it('a hung build times out and the next shot still draws', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const s = createIconShots(
      scene,
      { read: vi.fn(async () => new Uint8Array(32)), encode: vi.fn(async () => 'blob:x'), readNow: vi.fn(() => {}) },
      { buildTimeoutMs: 10 },
    );
    const hung: IconShotJob = { key: 'hung', view: VIEW, build: async () => new Promise<never>(() => {}) };
    const hungDone = s.shoot(hung);
    const nextDone = s.shoot(boxJob('next', log));
    expect(await shot(hungDone)).toBeNull();
    expect(await shot(nextDone)).toBe('blob:x');
  });

  it('warms the models of the queued shots ahead of the draw', async () => {
    const warm = vi.fn();
    const log = { built: [] as string[], disposed: [] as string[] };
    const s = createIconShots(
      scene,
      { read: vi.fn(async () => new Uint8Array(32)), encode: vi.fn(async () => 'blob:x'), readNow: vi.fn(() => {}) },
      { warm },
    );
    const first = s.shoot({ ...boxJob('a', log), files: ['Item/Axe01.glb'] });
    const second = s.shoot({ ...boxJob('b', log), files: ['Item/Sword01.glb'] });
    expect(warm).toHaveBeenCalledWith(['Item/Axe01.glb']);
    expect(warm).toHaveBeenCalledWith(['Item/Sword01.glb']);
    await shot(first);
    await shot(second);
  });

  it('a null picture is not cached: a later shoot draws it again', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    let attempts = 0;
    const flaky: IconShotJob = {
      key: 'flaky',
      view: VIEW,
      build: async root => {
        attempts++;
        if (attempts === 1) throw new Error('no model yet');
        return boxJob('flaky', log).build(root);
      },
    };
    expect(await shot(s.shoot(flaky))).toBeNull();
    expect(attempts).toBe(1);
    expect(await shot(s.shoot(flaky))).toBe('blob:4x2');
    expect(attempts).toBe(2);
  });

  it('a full shop of shots all land within a bounded number of frames', async () => {
    const log = { built: [] as string[], disposed: [] as string[] };
    const { shots: s } = shots();
    const done = Array.from({ length: 120 }, (_, i) => s.shoot(boxJob(`shop-${i}`, log)));
    const all = Promise.all(done);
    let settled = false;
    void all.then(() => void (settled = true), () => void (settled = true));
    for (let i = 0; i < 200 && !settled; i++) await frames(1);
    expect(settled).toBe(true);
    expect((await all).every(url => url !== null)).toBe(true);
  });
});
