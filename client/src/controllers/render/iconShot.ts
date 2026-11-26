import {
  Color4,
  RenderTargetTexture,
  TargetCamera,
  TransformNode,
  Vector3,
  type BaseTexture,
  type Observer,
  type Scene,
} from './babylon/exports';
import { getFlatLitVariant, warmGLTF } from '../assets/modelLoader';
import { CacheStorageStillStore, type IconStillStore } from './iconStillCache';

/**
 * One-shot pictures of a model (a bag item the icon pack has no file for): built on request, drawn
 * once into a small target with their own camera, read back, cached as an image URL and freed.
 * Nothing runs per frame while the queue is empty, and at most one picture is drawn per frame,
 * after the frame. A spin (the item under the cursor) keeps its target and redraws it turned
 * every frame into one kept buffer, one item at a time. See render/readme.md.
 */

/** The layer only the shot's camera draws: Babylon's default masks (0x0FFFFFFF) leave it out of every other view. */
export const ICON_LAYER = 0x10000000;

/** Frames a subject waits for its shaders and textures before it is drawn as it is. */
const READY_FRAMES = 120;

/**
 * Rounds of that wait a still gets before it is drawn anyway: a picture drawn
 * before its textures arrive is colourless, and the cache keeps it for the
 * session, so a slow texture gets more than one round. A texture that never
 * arrives still ends the wait, so a missing file cannot stall the queue.
 */
const READY_ATTEMPTS = 3;

/** Milliseconds a build may take before the queue moves on: a hung model fetch must not stall the grid behind it. */
const BUILD_TIMEOUT_MS = 30000;

/** The queue's options: how long a build may take, how queued files are warmed ahead of the draw, and where drawn pictures are kept across sessions. */
export type IconShotsOptions = {
  readonly buildTimeoutMs?: number;
  readonly warm?: (files: readonly string[]) => void;
  /** The pictures kept across sessions: a hit skips the queue, a drawn picture is kept. */
  readonly persistent?: IconStillStore;
};

/**
 * The picture: its size in pixels and the part of the root's frame it covers. The root turns MU's
 * frame upright, so a child placed as in the world (MU x, y, z on Babylon x, z, y) is seen as the
 * original's item camera sees its eye space: x right, y up, looking down -z.
 */
export type IconView = {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
};

export type IconSubject = { dispose(): void };

export type IconShotJob = {
  /** The cache key: one picture per key. */
  readonly key: string;
  readonly view: IconView;
  /** Puts the model under `root`; null when there is nothing to draw. */
  build(root: TransformNode): Promise<IconSubject | null>;
  /** The model files the build loads: warmed in parallel when the shot is queued, so the serial draw does not wait on each fetch in turn. */
  readonly files?: readonly string[];
  /** A spin's turn of the built model at `ms` (milliseconds), written in place. */
  readonly turn?: (ms: number) => void;
  /** The glow baked into the picture: the item's halo colour, 0..1 per channel. */
  readonly halo?: IconHalo;
};

/** The glow baked into a still: the item's halo colour, 0..1 per channel. */
export type IconHalo = { readonly r: number; readonly g: number; readonly b: number };

export type IconShotIo = {
  read(rtt: RenderTargetTexture, view: IconView): Promise<ArrayBufferView | null>;
  encode(pixels: Uint8ClampedArray, width: number, height: number): Promise<string>;
  /** The target's pixels into `out` at once: a spin reads every frame. */
  readNow(rtt: RenderTargetTexture, view: IconView, out: Uint8Array): void;
};

export type IconShots = {
  shoot(job: IconShotJob): Promise<string | null>;
  /**
   * Draws `job` turned every frame and hands `paint` the picture, always in the same kept array,
   * until the returned stop is called. A new spin stops the one before.
   */
  spin(job: IconShotJob, paint: (pixels: Uint8ClampedArray) => void): () => void;
  /** Drops every kept picture: the next shoot of a key draws it again. */
  forget(): void;
};

/** The engine's synchronous read (`engine.readTexture.js`): `readPixels` wraps it in a promise a call. */
type SyncRead = {
  _readTexturePixelsSync(texture: unknown, width: number, height: number, face: number, level: number, out: Uint8Array): void;
};

/** The shot's own light: the original draws a bag item at `Light = 1,1,1` with `LightEnable` off (ZzzInventory.cpp:9682-9699). */
const WHITE = new Vector3(1, 1, 1);
const CLEAR = new Color4(0, 0, 0, 0);

const BROWSER_IO: IconShotIo = {
  read: rtt => rtt.readPixels() ?? Promise.resolve(null),
  encode: async (pixels, width, height) => {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')?.putImageData(new ImageData(pixels, width, height), 0, 0);
    return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
  },
  readNow: (rtt, view, out) => {
    const engine = rtt.getScene()?.getEngine() as unknown as SyncRead | undefined;
    engine?._readTexturePixelsSync(rtt.getInternalTexture(), view.width, view.height, -1, 0, out);
  },
};

/** `255 * (v / 255) ^ (1 / 2.2)` for every byte: a linear read put on the display curve. */
const DISPLAY = Float64Array.from({ length: 256 }, (_, v) => 255 * (v / 255) ** (1 / 2.2));

/**
 * A read-back target as an image: rows flipped top-down and the premultiplied colour over the clear
 * (an additive glow leaves the cleared alpha at 0) made straight alpha, exact over black. A linear
 * frame buffer (image processing in post) is put on the display curve first. `out` is rewritten
 * whole when given (a spin's kept buffer).
 */
export function iconPixels(
  read: Uint8Array,
  width: number,
  height: number,
  linear: boolean,
  out = new Uint8ClampedArray(width * height * 4)
): Uint8ClampedArray {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((height - 1 - y) * width + x) * 4;
      const o = (y * width + x) * 4;
      let r = read[i];
      let g = read[i + 1];
      let b = read[i + 2];
      if (linear) {
        r = DISPLAY[r];
        g = DISPLAY[g];
        b = DISPLAY[b];
      }
      const a = Math.max(read[i + 3], r, g, b);
      if (a === 0) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }
      out[o] = (r * 255) / a;
      out[o + 1] = (g * 255) / a;
      out[o + 2] = (b * 255) / a;
      out[o + 3] = a;
    }
  }
  return out;
}

/**
 * Blur radius for the baked aura, as a share of the picture's short side.
 * Wider than the world's halo (slice 2 of the glow-097 fix): the still has
 * no GlowLayer and no motion, so a 1/12 aura read as a thin edge at icon
 * size; 1/8 reaches about 10 px out on a 40 px square.
 */
const HALO_SPREAD = 1 / 8;
/** Blur rounds: two separable passes for a soft falloff instead of a hard disc. */
const HALO_PASSES = 2;

function haloRadius(width: number, height: number): number {
  return Math.max(2, Math.round(Math.min(width, height) * HALO_SPREAD));
}

/** One horizontal box-blur pass over `src` (0..1 floats), zero outside the picture. */
function blurRow(src: Float32Array, width: number, height: number, radius: number, dst: Float32Array): void {
  const span = 2 * radius + 1;
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const row = y * width;
    for (let x = -radius; x <= radius; x++) {
      if (x >= 0 && x < width) sum += src[row + x];
    }
    for (let x = 0; x < width; x++) {
      dst[row + x] = sum / span;
      const out = x - radius;
      const inn = x + radius + 1;
      if (out >= 0) sum -= src[row + out];
      if (inn < width) sum += src[row + inn];
    }
  }
}

/** One vertical box-blur pass over `src` (0..1 floats), zero outside the picture. */
function blurColumn(src: Float32Array, width: number, height: number, radius: number, dst: Float32Array): void {
  const span = 2 * radius + 1;
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      if (y >= 0 && y < height) sum += src[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      dst[y * width + x] = sum / span;
      const out = y - radius;
      const inn = y + radius + 1;
      if (out >= 0) sum -= src[out * width + x];
      if (inn < height) sum += src[inn * width + x];
    }
  }
}

/**
 * A blurred, tinted aura from a picture's own alpha, as straight-alpha RGBA:
 * the silhouette's blurred mask in the halo colour. The item is drawn over it,
 * so its own pixels are never touched: the aura cannot flood the armour into
 * one bright shape the way raising the surface emissive did (FIX33-followup).
 */
export function iconHaloLayer(pixels: Uint8ClampedArray, width: number, height: number, halo: IconHalo): Uint8ClampedArray {
  const layer = new Uint8ClampedArray(pixels.length);
  if (halo.r <= 0 && halo.g <= 0 && halo.b <= 0) return layer;
  const radius = haloRadius(width, height);
  let mask = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) mask[i] = pixels[i * 4 + 3] / 255;
  const tmp = new Float32Array(width * height);
  for (let p = 0; p < HALO_PASSES; p++) {
    blurRow(mask, width, height, radius, tmp);
    blurColumn(tmp, width, height, radius, mask);
  }
  for (let i = 0; i < width * height; i++) {
    const a = Math.min(1, Math.max(0, mask[i]));
    const o = i * 4;
    // No aura here: keep the colour out too, so a transparent pixel never
    // carries a colour a blend could pick up.
    layer[o] = a > 0 ? Math.round(halo.r * 255) : 0;
    layer[o + 1] = a > 0 ? Math.round(halo.g * 255) : 0;
    layer[o + 2] = a > 0 ? Math.round(halo.b * 255) : 0;
    layer[o + 3] = Math.round(a * 255);
  }
  return layer;
}

/** `top` drawn over `bottom`, both straight-alpha RGBA; `out` defaults to `top`. */
export function compositeOver(top: Uint8ClampedArray, bottom: Uint8ClampedArray, out: Uint8ClampedArray = top): Uint8ClampedArray {
  for (let i = 0; i < top.length; i += 4) {
    const ta = top[i + 3] / 255;
    const ba = bottom[i + 3] / 255;
    const oa = ta + ba * (1 - ta);
    if (oa <= 0) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }
    out[i] = Math.round((top[i] * ta + bottom[i] * ba * (1 - ta)) / oa);
    out[i + 1] = Math.round((top[i + 1] * ta + bottom[i + 1] * ba * (1 - ta)) / oa);
    out[i + 2] = Math.round((top[i + 2] * ta + bottom[i + 2] * ba * (1 - ta)) / oa);
    out[i + 3] = Math.round(oa * 255);
  }
  return out;
}

/** A subject on its own stage: the root it is built under, its camera and target. */
type Stage = {
  readonly job: IconShotJob;
  root: TransformNode | null;
  subject: IconSubject | null;
  camera: TargetCamera | null;
  rtt: RenderTargetTexture | null;
  frames: number;
};

type Shot = Stage & {
  readonly resolve: (url: string | null) => void;
  drawn: boolean;
  /** Rounds of READY_FRAMES waited while the textures were still arriving. */
  attempts: number;
};

/** A texture bound per mesh (the item materials' `metadata.diffuseTexture`) that has not arrived yet. */
function texturesReady(rtt: RenderTargetTexture): boolean {
  for (const mesh of rtt.renderList ?? []) {
    const texture = mesh.metadata?.diffuseTexture as BaseTexture | undefined;
    if (typeof texture?.isReady === 'function' && !texture.isReady()) return false;
  }
  return true;
}

export function createIconShots(scene: Scene, io: IconShotIo = BROWSER_IO, options: IconShotsOptions = {}): IconShots {
  const cache = new Map<string, Promise<string | null>>();
  const queue: Shot[] = [];
  let current: Shot | null = null;
  let observer: Observer<Scene> | null = null;

  function next(): void {
    if (current) return;
    const shot = queue.shift();
    if (!shot) {
      if (observer) scene.onAfterRenderObservable.remove(observer);
      observer = null;
      return;
    }
    current = shot;
    void build(shot);
  }

  let spinning: (() => void) | null = null;

  /** The stage's target, camera, subject and root, freed. */
  function free(stage: Stage): void {
    stage.rtt?.dispose();
    stage.camera?.dispose();
    stage.subject?.dispose();
    stage.root?.dispose();
    stage.rtt = null;
    stage.camera = null;
    stage.subject = null;
    stage.root = null;
  }

  function finish(shot: Shot, url: string | null): void {
    free(shot);
    // A picture that landed missing is not kept: the next shoot draws it again.
    if (url === null) cache.delete(shot.job.key);
    // A drawn picture is kept across sessions, so the next visit reads it back instead of
    // drawing it again; the store fails open, and a clear since the draw drops it instead.
    if (url !== null) void options.persistent?.save(shot.job.key, url).catch(() => {});
    shot.resolve(url);
    current = null;
    next();
  }

  function rootFor(stage: Stage): TransformNode {
    const root = new TransformNode('itemIconRoot', scene);
    root.rotation.x = -Math.PI / 2;
    stage.root = root;
    return root;
  }

  /** Ready to draw, or waited for long enough. */
  function drawable(stage: Stage, rtt: RenderTargetTexture): boolean {
    return (rtt.isReadyForRendering() && texturesReady(rtt)) || ++stage.frames >= READY_FRAMES;
  }

  async function build(shot: Shot): Promise<void> {
    const root = rootFor(shot);
    let subject: IconSubject | null = null;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`Item icon ${shot.job.key} build timed out after ${options.buildTimeoutMs ?? BUILD_TIMEOUT_MS}ms; the queue moves on.`);
      finish(shot, null);
    }, options.buildTimeoutMs ?? BUILD_TIMEOUT_MS);
    try {
      subject = await shot.job.build(root);
    } catch (error) {
      console.warn(`Item icon ${shot.job.key} could not be built:`, error);
    } finally {
      clearTimeout(timer);
    }
    if (timedOut) {
      // The queue already moved on: free the late subject instead of drawing it.
      subject?.dispose();
      return;
    }
    if (!subject) {
      finish(shot, null);
      return;
    }
    shot.subject = subject;
    prepare(shot, root);
    observer ??= scene.onAfterRenderObservable.add(tick);
  }

  /** Out of every other view and pass, flat lit, then a camera and target of its own. */
  function prepare(shot: Stage, root: TransformNode): void {
    const meshes = root.getChildMeshes(false);
    for (const mesh of meshes) {
      mesh.layerMask = ICON_LAYER;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.applyFog = false;
      mesh.receiveShadows = false;
      mesh.isPickable = false;
      mesh.metadata ??= {};
      mesh.metadata.csmCaster = false;
      mesh.metadata.depthOccluder = false;
      // A still, not a world mesh: its sheen gets a floor on dark texels
      // (itemMaterial.ts FX_ICON_STILL), so the glow reads at icon size.
      mesh.metadata.iconStill = true;
      // A mesh lit by its own shine keeps it: the item's own colour over the bag's white.
      if (!mesh.metadata.shineLit) mesh.metadata.bodyLight = WHITE;
      if (!mesh.metadata.brightMesh) {
        const flat = getFlatLitVariant(scene, mesh);
        if (flat) mesh.material = flat;
      }
    }

    const { view } = shot.job;
    const camera = new TargetCamera('itemIconCamera', Vector3.Zero(), scene, false);
    camera.mode = TargetCamera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = view.left;
    camera.orthoRight = view.right;
    camera.orthoBottom = view.bottom;
    camera.orthoTop = view.top;
    camera.minZ = 0.01;
    camera.maxZ = 100;
    camera.layerMask = ICON_LAYER;

    const rtt = new RenderTargetTexture('itemIcon', { width: view.width, height: view.height }, scene, false);
    rtt.activeCamera = camera;
    rtt.renderList = meshes;
    rtt.clearColor = CLEAR;
    shot.camera = camera;
    shot.rtt = rtt;
  }

  /** After the frame: the current subject, once it is ready, drawn and read back. */
  function tick(): void {
    const shot = current;
    const rtt = shot?.rtt;
    if (!shot || !rtt || shot.drawn) return;
    if (!rtt.isReadyForRendering() || !texturesReady(rtt)) {
      if (++shot.frames < READY_FRAMES) return;
      if (shot.attempts < READY_ATTEMPTS) {
        // Drawing now would cache a colourless picture for the session:
        // wait another round for the textures instead.
        shot.frames = 0;
        shot.attempts++;
        return;
      }
    }

    shot.drawn = true;
    rtt.render();
    const { view } = shot.job;
    const linear = scene.imageProcessingConfiguration.applyByPostProcess;
    io.read(rtt, view)
      .then(read => {
        if (!read) return null;
        const pixels = iconPixels(new Uint8Array(read.buffer, read.byteOffset, read.byteLength), view.width, view.height, linear);
        if (shot.job.halo) compositeOver(pixels, iconHaloLayer(pixels, view.width, view.height, shot.job.halo));
        return io.encode(pixels, view.width, view.height);
      })
      .catch(error => {
        console.warn(`Item icon ${shot.job.key} could not be read:`, error);
        return null;
      })
      .then(url => finish(shot, url));
  }

  /** The job on the queue: its files warmed now, in parallel, so the serial draw does not wait on each cold fetch in turn. */
  function queueShot(job: IconShotJob): Promise<string | null> {
    const pending = new Promise<string | null>(resolve => {
      queue.push({ job, resolve, root: null, subject: null, camera: null, rtt: null, frames: 0, drawn: false, attempts: 0 });
    });
    // Warm the shot's files now, in parallel with the queue: by the time its
    // turn comes, the model and its textures are already in.
    if (job.files) options.warm?.(job.files);
    next();
    return pending;
  }

  return {
    shoot(job) {
      const cached = cache.get(job.key);
      if (cached) return cached;
      if (!options.persistent) {
        const pending = queueShot(job);
        cache.set(job.key, pending);
        return pending;
      }
      // A picture kept from an earlier visit answers without a build or a draw; a store that
      // fails reads as a miss, so the queue draws it as before.
      const pending = options.persistent
        .load(job.key)
        .catch(() => null)
        .then(stored => (stored ?? queueShot(job)));
      cache.set(job.key, pending);
      return pending;
    },

    forget() {
      cache.clear();
      // The kept pictures go too: a changed item-effects option draws every look again, and a
      // picture drawn with the old options must never be read back.
      try {
        options.persistent?.clear();
      } catch {
        // A store that cannot be cleared keeps its pictures: the next shoot reads them back.
      }
    },

    spin(job, paint) {
      spinning?.();
      const stage: Stage = { job, root: null, subject: null, camera: null, rtt: null, frames: 0 };
      const { view } = job;
      const read = new Uint8Array(view.width * view.height * 4);
      const pixels = new Uint8ClampedArray(read.length);
      let stopped = false;
      let frame: Observer<Scene> | null = null;

      const stop = (): void => {
        if (stopped) return;
        stopped = true;
        if (spinning === stop) spinning = null;
        if (frame) scene.onAfterRenderObservable.remove(frame);
        frame = null;
        free(stage);
      };
      spinning = stop;

      /** The halo under the turning picture, baked once from its first frame. */
      let haloLayer: Uint8ClampedArray | null = null;

      /** After the frame: turned, drawn and read into the kept buffers. */
      const draw = (): void => {
        const rtt = stage.rtt;
        if (!rtt || !drawable(stage, rtt)) return;
        stage.frames = READY_FRAMES;
        job.turn?.(performance.now());
        rtt.render();
        io.readNow(rtt, view, read);
        const drawn = iconPixels(read, view.width, view.height, scene.imageProcessingConfiguration.applyByPostProcess, pixels);
        if (job.halo) {
          haloLayer ??= iconHaloLayer(drawn, view.width, view.height, job.halo);
          compositeOver(drawn, haloLayer);
        }
        paint(drawn);
      };

      const root = rootFor(stage);
      job.build(root).then(
        subject => {
          if (stopped) {
            subject?.dispose();
            return;
          }
          stage.subject = subject;
          if (!subject) {
            stop();
            return;
          }
          prepare(stage, root);
          frame = scene.onAfterRenderObservable.add(draw);
        },
        error => {
          if (!stopped) console.warn(`Item icon ${job.key} could not be built:`, error);
          stop();
        }
      );
      return stop;
    },
  };
}

const perScene = new WeakMap<Scene, IconShots>();

/** The scene's shot queue, made on first use. Drawn pictures are kept across sessions (iconStillCache.ts), one cache per build. */
export function iconShots(scene: Scene): IconShots {
  let shots = perScene.get(scene);
  if (!shots) {
    shots = createIconShots(scene, BROWSER_IO, {
      warm: files => {
        for (const file of files) void warmGLTF(file, { scene });
      },
      persistent: new CacheStorageStillStore(),
    });
    perScene.set(scene, shots);
  }
  return shots;
}
