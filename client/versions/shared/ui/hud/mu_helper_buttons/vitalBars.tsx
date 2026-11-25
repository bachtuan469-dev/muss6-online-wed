import { observer } from 'mobx-react-lite';
import { t } from '@/i18n';
import { MuWindows } from '@/controllers/interface/windowManager';
import { Hero } from '@/modules/hero';
import { BaseClass, getBaseClass } from '@/modules/hero/characterStats';
import {
  AVATAR_CIRCLE_LEFT,
  AVATAR_CIRCLE_SIZE,
  VITAL_BAR_GAP,
  VITAL_BAR_HEIGHT,
  VITAL_BAR_HEIGHT_TALL,
  VITAL_BAR_WIDTH,
} from '../mobile_controls/consts';

/** No per-class portrait ships with the client, so the circle is a class badge. See the hud readme. */
const CLASS_CODE: Record<BaseClass, string> = {
  [BaseClass.Wizard]: 'DW',
  [BaseClass.Knight]: 'DK',
  [BaseClass.Elf]: 'EF',
  [BaseClass.MagicGladiator]: 'MG',
  [BaseClass.DarkLord]: 'DL',
  [BaseClass.Summoner]: 'SU',
  [BaseClass.RageFighter]: 'RF',
};

/**
 * FIX22 Việc 8: on a phone HP, MP, SD and AG leave the bottom bar and sit
 * as four short progress bars in that order, each in its orb colour, showing
 * the current number and how full it is. FIX23: they sit flush at the top
 * edge of the screen (the helper gears move right of them, same row), and
 * each bar is framed MU-style - rounded, bordered, shaded - with a bold
 * number that reads against the fill. Display only - the bars never take a tap.
 * FIX24 Việc 10: the order is HP, SD, AG, MP now, and AG is the original
 * gauge purple (#874098).
 * FIX26 Việc 5: a 40 px avatar circle sits left of the bars, with the
 * hero's level pinned to its bottom edge, and HP and MP are twice as tall
 * as SD and AG (20 vs 10). The circle opens the character info window;
 * the bars stay display-only.
 */
export const PhoneVitalBars = observer(() => {
  const rows = [
    { label: 'HP', fill: Hero.hpPercent, text: Hero.currentHP, color: '#e2140c', height: VITAL_BAR_HEIGHT_TALL },
    { label: 'SD', fill: Hero.sdPercent, text: Hero.currentSD, color: '#f0bd0e', height: VITAL_BAR_HEIGHT },
    { label: 'AG', fill: Hero.agPercent, text: Hero.currentAG, color: '#874098', height: VITAL_BAR_HEIGHT },
    { label: 'MP', fill: Hero.mpPercent, text: Hero.currentMP, color: '#0065f1', height: VITAL_BAR_HEIGHT_TALL },
  ];

  return (
    <div
      className="phone-vital-bars"
      style={{
        position: 'absolute',
        left: AVATAR_CIRCLE_LEFT,
        top: 0,
        display: 'flex',
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        className="phone-avatar-circle"
        title={t('muHelperButtons.characterInfo')}
        aria-label={t('muHelperButtons.characterInfo')}
        style={{
          position: 'relative',
          width: AVATAR_CIRCLE_SIZE,
          height: AVATAR_CIRCLE_SIZE,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: '2px solid #8a6d2f',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(64, 48, 16, 0.9), rgba(0, 0, 0, 0.8))',
          color: '#FFD700',
          fontSize: 13,
          fontWeight: 'bold',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        onClick={() => MuWindows.setOpen('character_info', !MuWindows.isOpen('character_info'))}
      >
        {CLASS_CODE[getBaseClass(Hero.charClass)]}
        <span
          className="phone-avatar-level"
          style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '1px 6px',
            border: '1px solid #8a6d2f',
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#FFD700',
            fontSize: 10,
            fontWeight: 'bold',
            lineHeight: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {Hero.level}
        </span>
      </button>
      <div
        className="phone-vital-bars-column"
        style={{
          width: VITAL_BAR_WIDTH,
          display: 'flex',
          flexDirection: 'column',
          gap: VITAL_BAR_GAP,
          pointerEvents: 'none',
        }}
      >
        {rows.map(row => {
          const percent = Math.round(row.fill * 100);
          return (
            <div
              key={row.label}
              className="phone-vital-bar"
              style={{
                position: 'relative',
                height: row.height,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0.55))',
                border: '1px solid rgba(0,0,0,0.7)',
                borderRadius: 5,
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.6)',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <div
                className="phone-vital-fill"
                style={{
                  width: `${percent}%`,
                  background: row.color,
                  height: '100%',
                  borderRadius: 4,
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.35)',
                }}
              />
              <span
                className="phone-vital-text"
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 0,
                  lineHeight: `${row.height}px`,
                  fontSize: 9,
                  fontWeight: 'bold',
                  color: '#fff',
                  textShadow: '0 1px 1px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.8)',
                }}
              >
                {row.label} {row.text} ({percent}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
