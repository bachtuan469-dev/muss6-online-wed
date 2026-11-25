import { useRef } from 'react';
import { useBarMotion } from '@/controllers/loading/creep';

/**
 * The background load as the 0.97 preloader shows it: one full-width bar
 * pinned to the bottom of the screen, with the real percent centred just
 * above it. No runner, no lightning, no status text: the percent is the
 * whole report, and it comes only from real byte counts.
 */
export const LoadingRunner = ({
  progress,
  done,
}: {
  progress: number;
  done: boolean;
}) => {
  // Never backwards: two loads reporting in turn must not pull the bar back.
  const peak = useRef(0);
  peak.current = Math.max(peak.current, Math.min(1, Math.max(0, progress)));
  const at = done ? 1 : peak.current;
  // Creeps past the report with `loadBarCreep` (`controllers/loading/creep.ts`).
  const { shown, transition } = useBarMotion(at);

  return (
    <div
      className={`ws-loader${done ? ' is-done' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(at * 100)}
      aria-label="Loading the game"
    >
      <span className="ws-loader-pct">{Math.round(at * 100)}%</span>
      <div className="ws-loader-track">
        <div className="ws-loader-fill" style={{ transform: `scaleX(${shown})`, transition }}>
          <div className="ws-loader-plasma" />
        </div>
      </div>
    </div>
  );
};
