import { beforeAll, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { applySceneLook, type SceneLook } from './sceneLook';
import { setGameOption } from '@/controllers/settings';

/**
 * The item glow layer's strength: the layer's own maximum, independent of
 * the player's Glow slider - that slider drives only the effect halo
 * (fx/glow.ts). The per-level ladder lives in the emissive selector
 * (itemHaloAt); a fixed lower rung (5/9, 0.25) compressed the top of that
 * ladder until +11 and up read as no glow on a phone. When the item layer
 * and the halo shared one knob, the halo's default of 0 killed both.
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
});
