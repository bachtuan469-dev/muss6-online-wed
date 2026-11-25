import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type Ref,
} from 'react';
import { observer } from 'mobx-react-lite';
import { MuWindows, type WindowCloser } from '../../windowManager';
import { isMobileDevice } from '../../mobile';
import { useUiViewport } from '../ui_stage';
import { bottomBarScreenHeight } from './barHeight';
import { GameOptions } from '@/controllers/settings';
import { t } from '@/i18n';

/**
 * Where an anchored window sits on a phone: centred in the play area above
 * the bottom bar, whole pixels, never off the screen. The window's rendered
 * size is its size times its scale.
 */
export function centredWindowPosition(
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
  scale: number,
  barHeight: number
): { left: number; top: number } {
  return {
    left: Math.max(0, Math.round((viewportWidth - width * scale) / 2)),
    top: Math.max(0, Math.round((viewportHeight - barHeight - height * scale) / 2)),
  };
}

type WindowChrome = {
  style: CSSProperties;
  onPointerDown: (event: PointerEvent) => void;
  /** Put on the window's root: joins the stack while the element is mounted. */
  ref: Ref<HTMLElement>;
  scale: number;
  anchored: boolean;
};

type WindowChromeOptions = {
  width: number;
  height: number;
  /** What Escape does while this is the top window. */
  onClose?: WindowCloser;
  /** Pixels reserved below the anchored window; the fit leaves them free. */
  fitAboveBottom?: number;
};

/**
 * Membership of the window stack for something that draws its own chrome
 * (the chat, the emote menu, a full-screen sheet). Registered while `open`,
 * raised by `MuWindows.raise`, closed by Escape through `onClose`.
 */
export function useWindowStackEntry(
  id: string,
  open: boolean,
  onClose?: WindowCloser
): void {
  const closerRef = useRef(onClose);
  closerRef.current = onClose;
  const closer = useCallback<WindowCloser>(() => closerRef.current?.(), []);

  useEffect(() => {
    if (!open) return;
    MuWindows.register(id, undefined, closer);
    return () => MuWindows.unregister(id);
  }, [id, open, closer]);
}

export function useWindowChrome(
  id: string,
  { width, height, onClose, fitAboveBottom }: WindowChromeOptions
): WindowChrome {
  const placement = MuWindows.placement(id);
  const dragging = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const closerRef = useRef(onClose);
  closerRef.current = onClose;

  // Mounted root = open window. A callback ref, not an effect, because some
  // callers run this hook while closed (they return null after it).
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        MuWindows.register(id, { width, height }, () => closerRef.current?.());
      } else {
        MuWindows.unregister(id);
      }
    },
    [id, width, height]
  );

  const onPointerDown = (event: PointerEvent) => {
    MuWindows.raise(id);

    if (event.button !== 0 || GameOptions.lockWindows) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;

    const root = event.currentTarget as HTMLElement;
    const rect = root.getBoundingClientRect();

    dragging.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    root.setPointerCapture(event.pointerId);
    event.preventDefault();

    const onMove = (move: globalThis.PointerEvent) => {
      const drag = dragging.current;
      if (!drag || move.pointerId !== drag.pointerId) return;
      // `moveTo` clamps to the viewport.
      MuWindows.moveTo(id, move.clientX - drag.offsetX, move.clientY - drag.offsetY);
    };

    const onUp = (up: globalThis.PointerEvent) => {
      if (dragging.current?.pointerId !== up.pointerId) return;

      dragging.current = null;
      root.releasePointerCapture(up.pointerId);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
  };

  const anchored = placement.x === null || placement.y === null;

  // The saved scale capped so the whole window fits the viewport, so a
  // resized window can never leave the screen bounds.
  const scale =
    fitAboveBottom === undefined
      ? MuWindows.scaleOf(id)
      : MuWindows.fitAboveScaleOf(id, fitAboveBottom);

  // FIX24 Việc 5: on a phone an anchored window opens in the middle of the
  // screen, not in a corner. A dragged window keeps its saved spot.
  const viewport = useUiViewport();
  const mobileCentred = anchored && isMobileDevice();
  const centred = mobileCentred
    ? centredWindowPosition(
        viewport.width,
        viewport.height,
        width,
        height,
        scale,
        bottomBarScreenHeight()
      )
    : null;

  const style: CSSProperties = {
    width,
    height,
    zIndex: MuWindows.zIndexOf(id),
    transform: `scale(${scale})`,
    transformOrigin: mobileCentred ? '0 0' : anchored ? '100% 100%' : '0 0',
    ...(centred
      ? { left: centred.left, top: centred.top, right: 'auto', bottom: 'auto' }
      : anchored
        ? {}
        : { left: placement.x!, top: placement.y!, right: 'auto', bottom: 'auto' }),
  };

  return { style, onPointerDown, ref, scale, anchored };
}

export const MuResizeGrip = observer(
  ({ id, width }: { id: string; width: number }) => {
    const start = useRef<{
      pointerId: number;
      x: number;
      scale: number;
    } | null>(null);

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const grip = event.currentTarget as HTMLElement;

      start.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        scale: MuWindows.scaleOf(id),
      };

      grip.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();

      const onMove = (move: globalThis.PointerEvent) => {
        const from = start.current;
        if (!from || move.pointerId !== from.pointerId) return;

        MuWindows.setScale(id, from.scale + (move.clientX - from.x) / width);
      };

      const onUp = (up: globalThis.PointerEvent) => {
        if (start.current?.pointerId !== up.pointerId) return;

        start.current = null;
        grip.releasePointerCapture(up.pointerId);
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', onUp);
        grip.removeEventListener('pointercancel', onUp);
      };

      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', onUp);
      grip.addEventListener('pointercancel', onUp);
    };

    if (GameOptions.lockWindows) return null;

    return (
      <div
        className="mu-resize-grip"
        data-no-drag="true"
        title={t('window.resizeHint')}
        onPointerDown={onPointerDown}
        onDoubleClick={() => MuWindows.reset(id)}
      />
    );
  }
);
