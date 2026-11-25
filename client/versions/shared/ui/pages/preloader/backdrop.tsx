import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { t, type TextKey } from '@/i18n';
import { loadCredits, type Credit } from '@/modules/credits';

/** What each kind of credit is billed as. */
const CREDIT_ROLE: Record<Credit['kind'] | 'reporter', TextKey> = {
  thanks: 'credits.thanks',
  person: 'credits.contributor',
  reporter: 'credits.reporter',
  playtest: 'credits.playtesting',
  everyone: 'credits.playtesting',
};

/** How long one credit stands before the next takes its place. */
const CREDIT_SHOW_MS = 4000;

/**
 * The preloader's backdrop, in the 0.97 style: the classic loading art full
 * screen, particles drifting up off it, and one contributor's credit standing
 * over it at a time, as a film's credits sit over a shot. The credit card
 * itself is the credits module's own visual and is not restyled: the role,
 * the name and the counts are exactly what the tour showed before, only the
 * map underneath is gone, so the credits take turns instead of taking stops.
 */
export const Backdrop = observer(() => {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    void loadCredits().then(setCredits);
  }, []);

  useEffect(() => {
    if (!credits.length) return;
    const timer = window.setInterval(
      () => setIndex(i => (i + 1) % credits.length),
      CREDIT_SHOW_MS
    );
    return () => window.clearInterval(timer);
  }, [credits.length]);

  const who = credits.length ? credits[index % credits.length] : null;

  return (
    <div className="ws-art" aria-hidden>
      <div className="ws-classic-bg" />
      <Embers />
      <div className="ws-credit" style={{ opacity: who ? 1 : 0 }}>
        {who && (
          <>
            <span className="ws-credit-role ws-mono">
              {t(
                CREDIT_ROLE[
                  who.kind === 'person' && !who.commits ? 'reporter' : who.kind
                ]
              )}
            </span>
            <span className="ws-credit-name">
              {who.kind === 'everyone' ? t('credits.everyone') : who.name}
            </span>
            {who.note && (
              <span className="ws-credit-meta ws-mono">{who.note}</span>
            )}
            {who.kind === 'person' && (
              <span className="ws-credit-meta ws-mono">
                {[
                  who.commits
                    ? t('credits.commits', { count: who.commits })
                    : '',
                  who.reports
                    ? t('credits.reports', { count: who.reports })
                    : '',
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </span>
            )}
          </>
        )}
      </div>
      <div className="ws-vignette" />
    </div>
  );
});

type Ember = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  da: number;
  color: string;
};

/**
 * The 0.97 preloader's particles: cold platinum dust with a little ruby
 * energy in it, drifting up and pulsing, 95 of them on a 1600x900 screen.
 */
const EMBER_COLORS = ['215,225,240', '215,225,240', '215,225,240', '239,68,68'];

/** Particles per 1600x900 of screen, so a small window is not a blizzard. */
const EMBER_DENSITY = 95;

const spawn = (w: number, h: number, anywhere: boolean): Ember => ({
  x: Math.random() * w,
  y: anywhere ? Math.random() * h : h + 4,
  r: 0.5 + Math.random() * 1.6,
  vx: (Math.random() - 0.5) * 0.28,
  vy: -(0.18 + Math.random() * 0.42),
  a: 0.15 + Math.random() * 0.5,
  da: (Math.random() - 0.5) * 0.01,
  color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
});

/** Sparse, slow and small: a mood behind the cards, not something to watch. */
const Embers = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let embers: Ember[] = [];
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round((EMBER_DENSITY * w * h) / (1600 * 900));
      embers = Array.from({ length: count }, () => spawn(w, h, true));
    };

    const step = (now: number) => {
      // Per 60 Hz frame, and capped so a tab coming back does not jump.
      const k = Math.min((now - last) / 16.7, 3);
      last = now;

      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];

        e.x += e.vx * k;
        e.y += e.vy * k;
        e.a += e.da * k;
        if (e.a < 0.15 || e.a > 0.65) e.da = -e.da;

        if (e.y < -4 || e.x < -4 || e.x > w + 4) {
          embers[i] = spawn(w, h, false);
          continue;
        }

        // Fade in over the bottom and out toward the top, where the logo is.
        const band = Math.min(1, (e.y / h) * 1.8);

        ctx.fillStyle = `rgba(${e.color},${(e.a * band).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(step);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="ws-embers" />;
};
