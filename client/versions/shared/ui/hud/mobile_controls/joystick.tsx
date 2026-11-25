import { useEffect, useRef, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { Ecs } from '@/ecs/current';
import { bottomBarScreenHeight } from '@/controllers/interface/components/mu_window';
import { HUD_BOTTOM_GAP, STICK_KNOB_SIZE, STICK_SIZE } from './consts';
import { stickVector } from './stickMath';

/**
 * A virtual stick: drag and the lean is written out, let go and it is
 * cleared. The knob tracks the finger, capped at the rim, deadzone or not.
 * The move stick writes `world.stickMove` (the walk); the aim side is gone
 * (user decision, 2026-11-24: a tap on a monster attacks it instead).
 */
const Stick = observer(
  ({
    className,
    style,
    onVector,
  }: {
    className: string;
    style?: CSSProperties;
    onVector: (vector: { x: number; y: number } | null) => void;
  }) => {
    const base = useRef<HTMLDivElement>(null);
    const knob = useRef<HTMLDivElement>(null);
    const dragId = useRef<number | null>(null);
    // The writer, always the latest render's: the unmount cleanup below runs
    // once, so it must not close over a stale one.
    const onVectorRef = useRef(onVector);
    onVectorRef.current = onVector;

    const setKnob = (dx: number, dy: number) => {
      const el = knob.current;
      if (el) {
        el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
    };

    const apply = (clientX: number, clientY: number) => {
      const el = base.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = clientX - (rect.left + radius);
      const dy = clientY - (rect.top + radius);
      onVector(stickVector(dx, dy, radius));
      // The knob tracks the finger, capped at the rim, deadzone or not.
      const length = Math.hypot(dx, dy);
      const capped = length > radius ? radius / length : 1;
      setKnob(dx * capped, dy * capped);
    };

    const release = () => {
      dragId.current = null;
      onVector(null);
      setKnob(0, 0);
    };

    // A stick left held by an unmount would walk the hero - or keep him
    // fighting - on its own.
    useEffect(() => () => onVectorRef.current(null), []);

    return (
      <div
        ref={base}
        className={className}
        style={{ width: STICK_SIZE, height: STICK_SIZE, ...style }}
        onPointerDown={e => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragId.current = e.pointerId;
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={e => {
          if (dragId.current === e.pointerId) apply(e.clientX, e.clientY);
        }}
        onPointerUp={e => {
          e.stopPropagation();
          if (dragId.current === e.pointerId) release();
        }}
        onPointerCancel={release}
        onContextMenu={e => e.preventDefault()}
      >
        <div
          ref={knob}
          className="mobile-stick-knob"
          style={{ width: STICK_KNOB_SIZE, height: STICK_KNOB_SIZE }}
        />
      </div>
    );
  }
);

/**
 * The virtual stick, lower left: drag and the hero walks the way it leans,
 * let go and he stops. It writes `world.stickMove` and nothing else;
 * `PlayerControllerSystem` turns the lean into the same walk requests the
 * W/A/S/D keys ask for, so pathfinding, the walk packets and the stop are
 * the client's own. It rides one gap above the bottom bar, like the rest
 * of the bottom row.
 */
export const Joystick = observer(() => (
  <Stick
    className="mobile-stick"
    style={{ bottom: bottomBarScreenHeight() + HUD_BOTTOM_GAP }}
    onVector={vector => {
      const world = Ecs.world;
      if (world) world.stickMove = vector;
    }}
  />
));
