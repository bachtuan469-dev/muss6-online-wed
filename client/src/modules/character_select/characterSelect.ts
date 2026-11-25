import { observable } from 'mobx';
import { Vector3 } from '../../controllers/render/babylon/exports';
import { toRadians } from '../../controllers/assets/download';

const MU_SCALE = 100;

function fromMu(x: number, y: number, z: number): Vector3 {
  return new Vector3(x / MU_SCALE, z / MU_SCALE, y / MU_SCALE);
}

export const CHARACTER_SLOTS = [
  { x: 8008, y: 18885, angle: 115 },
  { x: 7986, y: 19145, angle: 90 },
  { x: 8046, y: 19400, angle: 75 },
  { x: 8133, y: 19645, angle: 60 },
  { x: 8282, y: 19845, angle: 35 },
] as const;

export function characterSlotPosition(slot: number): Vector3 | null {
  const entry = CHARACTER_SLOTS[slot];
  if (!entry) return null;

  return fromMu(entry.x, entry.y, 169.5);
}

export function characterSlotAngle(slot: number): number {
  return toRadians(CHARACTER_SLOTS[slot]?.angle ?? 0);
}

export const CHARACTER_CAMERA_POSITION = fromMu(9758.93, 18913.11, 675.5);

const CAMERA_PITCH = -84.5;
const CAMERA_YAW = -75;

function cameraForward(): Vector3 {
  const pitch = toRadians(CAMERA_PITCH);
  const yaw = toRadians(CAMERA_YAW);

  const muX = -Math.sin(pitch) * Math.sin(yaw);
  const muY = -Math.sin(pitch) * Math.cos(yaw);
  const muZ = -Math.cos(pitch);

  return new Vector3(muX, muZ, muY).normalize();
}

export const CHARACTER_CAMERA_FORWARD = cameraForward();

/** The line-up camera's own right and up, from its forward and world up. */
const CAMERA_RIGHT = Vector3.Cross(
  Vector3.Up(),
  CHARACTER_CAMERA_FORWARD.scale(-1)
).normalize();
const CAMERA_UP = Vector3.Cross(
  CHARACTER_CAMERA_FORWARD.scale(-1),
  CAMERA_RIGHT
);

/**
 * Height above a slot's floor the line-up camera aims at: the body's centre,
 * the same height the right-click close-up aims at.
 */
export const LINEUP_AIM_HEIGHT = 1.1;

/** Half the 45 degree line-up camera's vertical view: tan(22.5 degrees). */
const LINEUP_FOV_TAN = Math.tan((22.5 * Math.PI) / 180);

/** How much of the frame the line-up may take: the five slots fit snug with a little air left. */
const LINEUP_FILL = 0.85;

/** Half a body's width sideways from its slot: the wings stick out past the shoulders. */
const BODY_HALF_WIDTH = 1.0;

/** Floor to head top, in scene units. */
const BODY_HEIGHT = 1.9;

/** Closest the line-up camera ever gets to the aim point, and farthest it ever pulls back. */
const LINEUP_DISTANCE_MIN = 4;
const LINEUP_DISTANCE_MAX = 30;

/**
 * The old far line-up shot's target: the slot centre projected on the
 * camera's forward axis. The login screen still uses this framing; the
 * character screen frames to the aspect instead (characterLineupCentre).
 */
export function characterCameraTarget(): Vector3 {
  const centre = Vector3.Zero();

  for (let slot = 0; slot < CHARACTER_SLOTS.length; slot++) {
    const pos = characterSlotPosition(slot);
    if (pos) centre.addInPlace(pos);
  }

  centre.scaleInPlace(1 / CHARACTER_SLOTS.length);

  const distance = Vector3.Dot(
    centre.subtract(CHARACTER_CAMERA_POSITION),
    CHARACTER_CAMERA_FORWARD
  );

  return CHARACTER_CAMERA_POSITION.add(
    CHARACTER_CAMERA_FORWARD.scale(distance)
  );
}

/** The line-up's mid-body centre: the average slot, raised to aim height. */
export function characterLineupCentre(): Vector3 {
  const centre = Vector3.Zero();

  for (let slot = 0; slot < CHARACTER_SLOTS.length; slot++) {
    const pos = characterSlotPosition(slot);
    if (pos) centre.addInPlace(pos);
  }

  centre.scaleInPlace(1 / CHARACTER_SLOTS.length);
  centre.y += LINEUP_AIM_HEIGHT;

  return centre;
}

/**
 * How far the line-up camera stands from the aim point, along its forward
 * ray, so all five slots (floor and head top, wings included) fit the frame
 * at the screen's aspect. Wider frames let it come closer; a narrow one
 * pulls it back, never past the clamp. Moving the camera along the ray only
 * shrinks every point's depth, never its sideways or vertical offset, so the
 * fit is one max over the points.
 */
export function characterLineupDistance(aspect: number): number {
  if (!(aspect > 0)) return LINEUP_DISTANCE_MAX;

  const centre = characterLineupCentre();
  let distance = LINEUP_DISTANCE_MIN;

  for (let slot = 0; slot < CHARACTER_SLOTS.length; slot++) {
    const floor = characterSlotPosition(slot);
    if (!floor) continue;

    for (const height of [0, BODY_HEIGHT]) {
      const point = new Vector3(floor.x, floor.y + height, floor.z);
      const rel = point.subtract(centre);
      const along = Vector3.Dot(rel, CHARACTER_CAMERA_FORWARD);
      const x = Math.abs(Vector3.Dot(rel, CAMERA_RIGHT)) + BODY_HALF_WIDTH;
      const y = Math.abs(Vector3.Dot(rel, CAMERA_UP));
      distance = Math.max(
        distance,
        x / (LINEUP_FILL * LINEUP_FOV_TAN * aspect) - along,
        y / (LINEUP_FILL * LINEUP_FOV_TAN) - along
      );
    }
  }

  return Math.min(LINEUP_DISTANCE_MAX, distance);
}

/**
 * Right-click close-up: the name of the character the camera is closed in on,
 * or null for the line-up shot. Set by CharacterSelectSystem, eased in and
 * out by LoginSceneSystem's camera. Independent of the focused character.
 * `connectRequests` counts double clicks on the focused character; the page answers each
 * like Connect (CharacterScene.cpp:214-223).
 */
export const characterSelectView = observable({ zoomedOn: null as string | null, connectRequests: 0 });

/**
 * What one press on the line-up does (CharacterScene.cpp): the right button
 * closes in on the character under the pointer, or back out when it is the
 * zoomed one already or the press lands on empty stage; the left button
 * selects the character under the pointer, greets when it is the focused
 * one already, and connects when the press is a double click on it. Pure,
 * so the rules sit in one tested place; CharacterSelectSystem feeds it the
 * press and runs the effect.
 */
export type CharSelectPressAction =
  | { action: 'zoom'; name: string | null }
  | { action: 'select'; name: string }
  | { action: 'connect' }
  | { action: 'greet' }
  | { action: 'none' };

export function decideCharSelectPress(input: {
  button: number;
  hoveredName: string | null;
  focusedName: string;
  zoomedName: string | null;
  double: boolean;
}): CharSelectPressAction {
  const { button, hoveredName, focusedName, zoomedName, double } = input;

  if (button === 2) {
    return {
      action: 'zoom',
      name: hoveredName && hoveredName !== zoomedName ? hoveredName : null,
    };
  }

  if (button !== 0 || !hoveredName) return { action: 'none' };
  if (hoveredName !== focusedName) return { action: 'select', name: hoveredName };
  return double ? { action: 'connect' } : { action: 'greet' };
}

/** `GetDoubleClickTime`'s default, which `CInput` reads (Input.cpp:40). */
const DOUBLE_CLICK_MS = 500;

/**
 * `CInput`'s left button (Input.cpp:131-148): a press within the double-click time of a single
 * press is a double click, and the press after a double starts over. Feed it every left press.
 */
export function doubleClicks(windowMs = DOUBLE_CLICK_MS): (now: number) => boolean {
  let last = -Infinity;
  let former = false;
  return now => {
    const double = former && now - last <= windowMs;
    former = !double;
    last = now;
    return double;
  };
}
