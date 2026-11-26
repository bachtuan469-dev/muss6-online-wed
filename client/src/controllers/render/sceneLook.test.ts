import { beforeAll, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { applySceneLook, itemGlowIntensity, type SceneLook } from './sceneLook';
import { GameOptions, setGameOption } from '@/controllers/settings';
import { itemHaloAt, itemVisualTier } from '@/controllers/item_fx/itemVisualTier';

/**
 * The item glow layer's strength: the layer's own maximum, independent of
 * the player's Glow slider - that slider drives only the effect halo
 * (fx/glow.ts). The per-level ladder lives in the emissive selector
 * (itemHaloAt); a fixed lower rung (5/9, 0.25) compressed the top of that
 * ladder until +11 and up read as no glow on a phone. When the item layer
 * and the halo shared one knob, the halo's default of 0 killed both.
 * The maximum is 0.45 again, restored 2026-11-26 (slice 1 of the glow-097
 * fix): at 0.9 the worn-gear aura peaked at 0.46 even at +15 and flooded the
 * armor into white (white area in the hero box 1.2% at 0.45 -> 8.68% at 0.9,
 * Grand Soul chest (255,100,190) sat 0.61 -> (251,223,248) sat 0.11, clipped).
 * At 0.45 the +15 aura peaks at 0.23, still a quarter of the +15 surface
 * sheen (1.76), so the armor keeps its shape instead of flooding into one
 * bright blob. The headroom clamp on the sheen (itemMaterial.ts) is restored
 * in the same slice; the two together return the 07:20 benchmark.
 */
describe('item glow strength', () => {
  let look: SceneLook;

  beforeAll(() => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera('cam', 0, 0, 10, Vector3.Zero(), scene);
    scene.activeCamera = camera;
    look = applySceneLook(scene, camera);
  });

  it('sits at the layer maximum on default options', () => {
    expect(look.glow.intensity).toBeCloseTo(0.45);
  });

  it('does not follow the Glow slider', () => {
    setGameOption('glow', 9);
    expect(look.glow.intensity).toBeCloseTo(0.45);
    setGameOption('glow', 0);
    expect(look.glow.intensity).toBeCloseTo(0.45);
  });

  it('is off only when post-processing and improved item effects are both off', () => {
    setGameOption('postProcessing', false);
    expect(look.glow.intensity).toBeCloseTo(0.45);
    setGameOption('itemEffects', 0);
    expect(look.glow.intensity).toBeCloseTo(0);
    setGameOption('itemEffects', 2);
    setGameOption('postProcessing', true);
    expect(look.glow.intensity).toBeCloseTo(0.45);
  });

  it('lifts the worn-gear aura at every rung (effective halo peaks)', () => {
    const savedLevel = GameOptions.effectLevel;
    const savedEffects = GameOptions.itemEffects;
    setGameOption('effectLevel', 4);
    setGameOption('itemEffects', 2);
    try {
      // Halo ladder x Both scale 0.65 x layer 0.45, at the pulse top.
      const peaks: Array<[number, number]> = [
        [7, 0.18],
        [9, 0.32],
        [11, 0.48],
        [13, 0.62],
        [15, 0.78],
      ];
      for (const [level, halo] of peaks) {
        const tier = itemVisualTier({ group: 0, num: 16, lvl: level } as never);
        const out = itemHaloAt(tier, Math.PI / 2 / tier.pulseRate, { r: 0, g: 0, b: 0 });
        expect(Math.max(out.r, out.g, out.b) * itemGlowIntensity(true)).toBeCloseTo(
          halo * 0.65 * 0.45,
          3,
        );
      }
    } finally {
      setGameOption('effectLevel', savedLevel);
      setGameOption('itemEffects', savedEffects);
    }
  });
});
