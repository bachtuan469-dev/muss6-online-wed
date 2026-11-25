import './style.less';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { With } from 'miniplex';
import type { Entity } from '@/ecs/world';
import type { Events } from '@/core/eventBus/events';
import type { MuSprite } from '@/controllers/assets/mu';
import {
  useEventBus,
  usePositionOnScreen,
} from '@/controllers/interface/hooks';
import { useMuSprite } from '@/controllers/interface/components/mu_sprite';
import { pageHidden } from '@/core/utils';

const FONT_FILE = 'FontTest.OZT';

const ATLAS_WIDTH = 256;
const ATLAS_HEIGHT = 32;

const DIGIT_CELL = 16;

const MISS_SRC = { x: 0, y: 17, width: 32, height: 15 };
const MISS_SIZE = { width: 45, height: 20 };

const SPAWN_HEIGHT = 140;
const START_GRAVITY = 10;
const GRAVITY_DECAY = 0.3;
const SCALE_DECAY = 5;
const MIN_SCALE = 15;
const ALPHA_FROM_GRAVITY = 0.4;

const REFERENCE_FPS = 25;

const NORMAL_SCALE = 15;
const BIG_SCALE = 50;

const MAX_POINTS = 100;

const MU_SCALE = 100;

const PX_PER_MU = DIGIT_CELL / MIN_SCALE;

/**
 * The view height the pixel constants are calibrated to: PX_PER_MU puts one
 * tile at ~107 px, the original's ~5.6 tiles over a 600 px view.
 */
const REFERENCE_VIEW_HEIGHT = 600;

/**
 * The numbers are fixed CSS pixels while the world is projected, so on a
 * shorter view (a phone in landscape) they tower over the monster they rose
 * from. Shrinking them with the view height keeps the original's
 * proportions; capped at 1, so a desktop view renders exactly as before.
 */
export function viewScaleForHeight(height: number): number {
  if (!(height > 0)) return 1;
  return Math.min(1, height / REFERENCE_VIEW_HEIGHT);
}

const DIGIT_ADVANCE = DIGIT_CELL * Math.SQRT1_2;

type Rgb = readonly [number, number, number];

const SHIELD_COLOUR: Rgb = [0.8, 1, 0];
const MISS_SELF_COLOUR: Rgb = [1, 1, 1];
const MISS_OTHER_COLOUR: Rgb = [0.5, 0.5, 0.5];

function shade(colour: Rgb, amount: number): Rgb {
  return [
    Math.max(0, colour[0] - amount),
    Math.max(0, colour[1] - amount),
    Math.max(0, colour[2] - amount),
  ];
}

function toCss(colour: Rgb): string {
  const [r, g, b] = colour;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255
  )})`;
}

function lookFor(kind: number, onSelf: boolean): { colour: Rgb; scale: number } {
  switch (kind) {
    case 0:
      return {
        colour: onSelf ? [1, 0, 0] : [1, 0.6, 0],
        scale: NORMAL_SCALE,
      };
    case 1:
      return { colour: [0, 1, 1], scale: BIG_SCALE };
    case 2:
      return { colour: [0, 1, 0.6], scale: BIG_SCALE };
    case 3:
      return { colour: [0, 0.6, 1], scale: BIG_SCALE };
    case 4:
      return { colour: [1, 0, 1], scale: NORMAL_SCALE };
    case 5:
      return { colour: [0, 1, 0], scale: NORMAL_SCALE };
    case 6:
      return { colour: [0.7, 0.4, 1], scale: NORMAL_SCALE };
    default:
      return { colour: [1, 1, 1], scale: NORMAL_SCALE };
  }
}

const MISS = -1;

type Spawn = {
  value: number;
  colour: Rgb;
  scale: number;
  height: number;
};

export function spawnsFor(event: Events['objectDamaged'], onSelf: boolean): Spawn[] {
  const { healthDamage, shieldDamage, kind, isDouble, isTriple } = event;
  const spawns: Spawn[] = [];
  // A hidden page draws nothing: these would all rise together when it shows (the original's run out unseen).
  if (pageHidden()) return spawns;

  if (healthDamage === 0) {
    spawns.push({
      value: MISS,
      colour: onSelf ? MISS_SELF_COLOUR : MISS_OTHER_COLOUR,
      scale: NORMAL_SCALE,
      height: 0,
    });
  } else {
    const look = lookFor(kind, onSelf);
    const colour = look.colour;
    const scale = isTriple ? BIG_SCALE : look.scale;

    if (isTriple) {
      spawns.push({ value: healthDamage, colour: shade(colour, 0.4), scale, height: 0 });
      spawns.push({ value: healthDamage, colour: shade(colour, 0.2), scale: scale + 5, height: 10 });
      spawns.push({ value: healthDamage, colour, scale: scale + 10, height: 20 });
    } else if (isDouble) {
      spawns.push({ value: healthDamage, colour: shade(colour, 0.4), scale, height: 0 });
      spawns.push({ value: healthDamage, colour: shade(colour, 0.2), scale: scale + 5, height: 10 });
    }

    spawns.push({ value: healthDamage, colour, scale, height: 0 });
  }

  if (shieldDamage > 0) {
    spawns.push({
      value: shieldDamage,
      colour: SHIELD_COLOUR,
      scale: NORMAL_SCALE,
      height: 25,
    });
  }

  return spawns;
}

type FloatingNumber = Spawn & {
  id: number;
  entity: With<Entity, 'transform' | 'screenPosition'>;
};

export const DamageNumbers = () => {
  const [numbers, setNumbers] = useState<FloatingNumber[]>([]);
  const nextId = useRef(0);

  const font = useMuSprite(FONT_FILE);

  // Warm every tint the spawns can use, so a hit never waits on a canvas.
  useEffect(() => {
    if (!font) return;
    for (const colour of paletteColours()) void tintAtlasUrl(font, colour);
  }, [font]);

  useEventBus('objectDamaged', event => {
    const onSelf = event.entity.localPlayer === true;

    const spawned = spawnsFor(event, onSelf).map(spawn => ({
      ...spawn,
      id: nextId.current++,
      entity: event.entity,
    }));

    // The newest numbers win when the cap is hit (`slice(0, …)` kept the
    // oldest and dropped every fresh hit in a crowded fight).
    setNumbers(previous =>
      [...previous, ...spawned].slice(-MAX_POINTS)
    );
  });

  // Expiries are batched: a burst of numbers spawned together also ends
  // together, and one `setState` per frame beats one per number.
  const expired = useRef(new Set<number>());
  const flush = useRef(0);
  useEffect(() => () => cancelAnimationFrame(flush.current), []);
  const remove = useCallback((id: number) => {
    expired.current.add(id);
    if (flush.current) return;
    flush.current = requestAnimationFrame(() => {
      flush.current = 0;
      const gone = expired.current;
      expired.current = new Set();
      setNumbers(previous => previous.filter(number => !gone.has(number.id)));
    });
  }, []);

  return (
    <div className="damage-numbers">
      {numbers.map(number => (
        <FloatingDamageNumber
          key={number.id}
          number={number}
          font={font}
          onDone={remove}
        />
      ))}
    </div>
  );
};

const FloatingDamageNumber = ({
  number,
  font,
  onDone,
}: {
  number: FloatingNumber;
  font: MuSprite | null;
  onDone: (id: number) => void;
}) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const glyphsRef = useRef<HTMLDivElement>(null);

  usePositionOnScreen(number.entity, anchorRef);

  useEffect(() => {
    let gravity = START_GRAVITY;
    let scale = number.scale;
    let height = SPAWN_HEIGHT + number.height;
    let last = performance.now();
    let frame = 0;

    const anchorHeight = number.entity.screenPosition.worldOffsetZ * MU_SCALE;
    const viewScale = viewScaleForHeight(
      anchorRef.current?.parentElement?.clientHeight ?? 0
    );

    const step = (now: number) => {
      const factor = Math.min(((now - last) / 1000) * REFERENCE_FPS, 1);
      last = now;

      height += gravity * factor;
      gravity -= GRAVITY_DECAY * factor;
      scale = Math.max(MIN_SCALE, scale - SCALE_DECAY * factor);

      if (gravity <= 0) {
        onDone(number.id);
        return;
      }

      const element = glyphsRef.current;

      if (element) {
        const offsetY = (anchorHeight - height) * PX_PER_MU * viewScale;
        const zoom =
          (number.value === MISS ? 1 : scale / MIN_SCALE) * viewScale;

        element.style.transform = `translate(-50%, ${offsetY.toFixed(
          1
        )}px) scale(${zoom.toFixed(3)})`;
        element.style.opacity = Math.min(
          1,
          gravity * ALPHA_FROM_GRAVITY
        ).toFixed(3);
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [number, onDone]);

  const atlasUrl = useTintedAtlas(font, number.colour);

  return (
    <div ref={anchorRef} className="damage-number">
      <div ref={glyphsRef} className="glyphs">
        {font &&
          atlasUrl &&
          (number.value === MISS ? (
            <MissGlyph atlasUrl={atlasUrl} />
          ) : (
            <DigitGlyphs atlasUrl={atlasUrl} value={number.value} />
          ))}
      </div>
    </div>
  );
};

/**
 * The original modulates the shaded font texture by the hit colour
 * (glColor4f); a CSS mask would fill the glyph flat and read bolder.
 * So the atlas is multiplied by the colour once per colour on a canvas.
 */
export function multiplyPixels(data: Uint8ClampedArray, colour: Rgb): void {
  const [r, g, b] = colour;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * r);
    data[i + 1] = Math.round(data[i + 1] * g);
    data[i + 2] = Math.round(data[i + 2] * b);
  }
}

/** Every colour spawnsFor can emit, so the tints are warm before a hit lands. */
export function paletteColours(): Rgb[] {
  const colours = new Map<string, Rgb>();
  const add = (colour: Rgb) => colours.set(toCss(colour), colour);
  for (let kind = 0; kind <= 6; kind++) {
    for (const onSelf of [false, true]) {
      const { colour } = lookFor(kind, onSelf);
      add(colour);
      add(shade(colour, 0.2));
      add(shade(colour, 0.4));
    }
  }
  add([1, 1, 1]);
  add(shade([1, 1, 1], 0.2));
  add(shade([1, 1, 1], 0.4));
  add(SHIELD_COLOUR);
  add(MISS_SELF_COLOUR);
  add(MISS_OTHER_COLOUR);
  return [...colours.values()];
}

const tintPromises = new Map<string, Promise<string>>();
const tintUrls = new Map<string, string>();

function tintKey(font: MuSprite, colour: Rgb): string {
  return `${font.url}|${toCss(colour)}`;
}

/** The atlas multiplied by `colour`, as an object URL (the font URL on failure). */
export function tintAtlasUrl(font: MuSprite, colour: Rgb): Promise<string> {
  const key = tintKey(font, colour);
  const ready = tintUrls.get(key);
  if (ready) return Promise.resolve(ready);
  let pending = tintPromises.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const blob = await (await fetch(font.url)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return font.url;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        multiplyPixels(image.data, colour);
        ctx.putImageData(image, 0, 0);
        const encode = (type: string) =>
          new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 1));
        const out = (await encode('image/webp')) ?? (await encode('image/png'));
        if (!out) return font.url;
        const url = URL.createObjectURL(out);
        tintUrls.set(key, url);
        return url;
      } catch {
        return font.url;
      }
    })();
    tintPromises.set(key, pending);
  }
  return pending;
}

function useTintedAtlas(font: MuSprite | null, colour: Rgb): string | null {
  const key = font ? tintKey(font, colour) : '';
  const [url, setUrl] = useState<string | null>(() =>
    key ? tintUrls.get(key) ?? null : null
  );

  useEffect(() => {
    if (!font) return;
    let live = true;
    void tintAtlasUrl(font, colour).then(u => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}

function spriteStyle(atlasUrl: string, x: number, y: number) {
  return {
    backgroundImage: `url(${atlasUrl})`,
    backgroundSize: `${ATLAS_WIDTH}px ${ATLAS_HEIGHT}px`,
    backgroundPosition: `${-x}px ${-y}px`,
    backgroundRepeat: 'no-repeat',
  } as const;
}

const DigitGlyphs = ({
  atlasUrl,
  value,
}: {
  atlasUrl: string;
  value: number;
}) => {
  const digits = String(value);

  return (
    <div
      className="digits"
      style={{
        width: (digits.length - 1) * DIGIT_ADVANCE + DIGIT_CELL,
        height: DIGIT_CELL,
      }}
    >
      {[...digits].map((digit, i) => (
        <span
          key={i}
          className="digit"
          style={{
            left: i * DIGIT_ADVANCE,
            width: DIGIT_CELL,
            height: DIGIT_CELL,
            ...spriteStyle(atlasUrl, Number(digit) * DIGIT_CELL, 0),
          }}
        />
      ))}
    </div>
  );
};

const MissGlyph = ({ atlasUrl }: { atlasUrl: string }) => {
  const zoomX = (MISS_SIZE.width * PX_PER_MU) / MISS_SRC.width;
  const zoomY = (MISS_SIZE.height * PX_PER_MU) / MISS_SRC.height;

  const width = MISS_SIZE.width * PX_PER_MU;
  const height = MISS_SIZE.height * PX_PER_MU;

  return (
    <div className="digits" style={{ width, height }}>
      <span
        className="digit"
        style={{
          left: 0,
          width,
          height,
          backgroundImage: `url(${atlasUrl})`,
          backgroundSize: `${ATLAS_WIDTH * zoomX}px ${ATLAS_HEIGHT * zoomY}px`,
          backgroundPosition: `${-MISS_SRC.x * zoomX}px ${-MISS_SRC.y * zoomY}px`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
};
