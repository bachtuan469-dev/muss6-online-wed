/**
 * The one place the client decides it is played by touch (`?mobile=1|0` overrides).
 * Imported by `app/main.tsx` before the version loads, so it has no imports. See readme.md.
 */

const ROOT_CLASS = 'mu-mobile';

function readOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  // `location` can be missing where tests stub `window` (camera/view.test.ts).
  const param = new URLSearchParams(window.location?.search ?? '').get('mobile');
  if (param === '1') return true;
  if (param === '0') return false;
  return null;
}

function detect(): boolean {
  const override = readOverride();
  if (override !== null) return override;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse && navigator.maxTouchPoints > 0;
}

const mobile = detect();

// The class the stylesheets key on, set before React's first paint so no
// desktop rule flashes on a phone.
if (mobile && typeof document !== 'undefined') {
  document.documentElement.classList.add(ROOT_CLASS);
}

export function isMobileDevice(): boolean {
  return mobile;
}

/**
 * Ask the browser to hold the game sideways, once, from the first touch
 * (user decision, 2026-11-23: landscape-only on phones). Chrome on Android
 * grants `orientation.lock` to a gesture (and to an installed PWA, whose
 * manifest already asks for landscape); iOS Safari has no such API, where
 * the portrait overlay (`rotate_overlay`) is the enforcement. A refused
 * lock is silent by design: it must never break the tap that carried it.
 */
export function lockLandscapeOnFirstTouch(): void {
  if (!mobile || typeof window === 'undefined') return;
  // This TS lib's `ScreenOrientation` has no `lock`; the API is real on
  // Android Chrome and guarded at runtime, so the cast is type-only.
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & { lock: (orientation: string) => Promise<void> })
    | undefined;
  if (!orientation || typeof orientation.lock !== 'function') return;

  const attempt = () => {
    window.removeEventListener('pointerdown', attempt);
    try {
      const locking = orientation.lock('landscape') as unknown as
        | Promise<void>
        | undefined;
      locking?.catch(() => {});
    } catch {
      // Not fullscreen, not allowed: the overlay covers it.
    }
  };
  window.addEventListener('pointerdown', attempt);
}

export function useIsMobile(): boolean {
  return mobile;
}
