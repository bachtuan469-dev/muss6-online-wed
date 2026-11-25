import { describe, expect, it } from 'vitest';
import { Vector3 } from '../../controllers/render/babylon/exports';
import {
  CHARACTER_CAMERA_FORWARD,
  characterLineupCentre,
  characterLineupDistance,
  characterSlotPosition,
  decideCharSelectPress,
  doubleClicks,
} from './characterSelect';

// Slots 0-4 always exist; a missing one is a test failure, not a skip.
function slotPosition(slot: number): Vector3 {
  const pos = characterSlotPosition(slot);
  if (!pos) throw new Error(`no character slot ${slot}`);
  return pos;
}

// CInput's left button (Input.cpp:131-148): a press within GetDoubleClickTime of a single press is a
// double click, and the press after a double starts over.
describe('doubleClicks', () => {
  it('reads a second press within 500 ms as a double click', () => {
    const isDouble = doubleClicks();
    expect(isDouble(1000)).toBe(false);
    expect(isDouble(1400)).toBe(true);
  });

  it('starts over after a double click', () => {
    const isDouble = doubleClicks();
    isDouble(0);
    isDouble(200);
    expect(isDouble(300)).toBe(false);
    expect(isDouble(500)).toBe(true);
  });

  it('leaves slow presses single', () => {
    const isDouble = doubleClicks();
    isDouble(0);
    expect(isDouble(600)).toBe(false);
    expect(isDouble(1200)).toBe(false);
  });
});

// One press on the line-up (CharacterScene.cpp): left selects, a double on
// the selected character connects, a single on it greets, right closes in.
describe('decideCharSelectPress', () => {
  const base = { hoveredName: 'Dw', focusedName: 'Dk', zoomedName: null, double: false };

  it('selects the pressed character when another one is focused', () => {
    expect(decideCharSelectPress({ ...base, button: 0 })).toEqual({ action: 'select', name: 'Dw' });
  });

  it('selects when nothing is focused yet', () => {
    expect(decideCharSelectPress({ ...base, button: 0, focusedName: '' })).toEqual({ action: 'select', name: 'Dw' });
  });

  it('does nothing on an empty part of the stage', () => {
    expect(decideCharSelectPress({ ...base, button: 0, hoveredName: null })).toEqual({ action: 'none' });
  });

  it('greets on a single press on the focused character', () => {
    expect(decideCharSelectPress({ ...base, button: 0, hoveredName: 'Dk' })).toEqual({ action: 'greet' });
  });

  it('connects on a double press on the focused character', () => {
    expect(decideCharSelectPress({ ...base, button: 0, hoveredName: 'Dk', double: true })).toEqual({ action: 'connect' });
  });

  it('ignores the middle button', () => {
    expect(decideCharSelectPress({ ...base, button: 1 })).toEqual({ action: 'none' });
  });

  it('zooms in on the pressed character with the right button', () => {
    expect(decideCharSelectPress({ ...base, button: 2 })).toEqual({ action: 'zoom', name: 'Dw' });
  });

  it('zooms back out on a right press on the zoomed character', () => {
    expect(decideCharSelectPress({ ...base, button: 2, hoveredName: 'Dk', zoomedName: 'Dk' })).toEqual({ action: 'zoom', name: null });
  });

  it('zooms back out on a right press on empty stage', () => {
    expect(decideCharSelectPress({ ...base, button: 2, hoveredName: null, zoomedName: 'Dk' })).toEqual({ action: 'zoom', name: null });
  });
});

// The line-up framing (FIX21): the five slots fit the frame at the screen's
// aspect, zoomed in from the old 17.7-unit shot. The camera sits on the same
// forward ray, aimed at the line-up's mid-body centre, at the distance the
// fit asks for.
describe('characterLineupDistance', () => {
  // The old shot: slot centre projected on the forward axis from the old
  // camera position, 17.73 units out.
  const OLD_DISTANCE = 17.73;

  it('aims at the slot centre raised to mid-body height', () => {
    const centre = characterLineupCentre();
    expect(centre.x).toBeCloseTo(80.91, 1);
    expect(centre.y).toBeCloseTo(2.8, 1);
    expect(centre.z).toBeCloseTo(193.84, 1);
  });

  it('zooms in from the old shot at 16:9', () => {
    const d = characterLineupDistance(16 / 9);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(OLD_DISTANCE);
    expect(d).toBeCloseTo(10.23, 1);
  });

  it('zooms in further on the wider phone landscape frame', () => {
    expect(characterLineupDistance(844 / 390)).toBeCloseTo(8.53, 1);
  });

  it('pulls back on a squarer frame', () => {
    expect(characterLineupDistance(4 / 3)).toBeCloseTo(13.42, 1);
  });

  it('never pulls back past the clamp on a portrait frame', () => {
    expect(characterLineupDistance(390 / 844)).toBe(30);
  });

  it('never comes closer than the floor', () => {
    expect(characterLineupDistance(100)).toBeGreaterThanOrEqual(4);
  });

  it('fits every slot floor and head inside the frame at 16:9 and phone landscape', () => {
    for (const aspect of [16 / 9, 844 / 390]) {
      const centre = characterLineupCentre();
      const position = centre.subtract(
        CHARACTER_CAMERA_FORWARD.scale(characterLineupDistance(aspect))
      );
      for (let slot = 0; slot < 5; slot++) {
        for (const height of [0, 1.9]) {
          const point = slotPosition(slot);
          point.y += height;
          const ndc = projectToNdc(point, position, centre, aspect);
          expect(Math.abs(ndc.x)).toBeLessThanOrEqual(0.85);
          expect(Math.abs(ndc.y)).toBeLessThanOrEqual(0.85);
        }
      }
    }
  });
});

// Babylon's camera basis for a camera at `position` looking at `target`:
// forward is CHARACTER_CAMERA_FORWARD, right is up x -forward, up is
// -forward x right. NDC of `point` at the 45 degree vertical FOV.
function projectToNdc(
  point: Vector3,
  position: Vector3,
  target: Vector3,
  aspect: number
): { x: number; y: number } {
  const forward = target.subtract(position).normalize();
  const zAxis = forward.scale(-1);
  const right = Vector3.Cross(Vector3.Up(), zAxis).normalize();
  const up = Vector3.Cross(zAxis, right);
  const rel = point.subtract(position);
  const z = Vector3.Dot(rel, forward);
  const tan = Math.tan((22.5 * Math.PI) / 180);
  return {
    x: Vector3.Dot(rel, right) / (z * tan * aspect),
    y: Vector3.Dot(rel, up) / (z * tan),
  };
}
