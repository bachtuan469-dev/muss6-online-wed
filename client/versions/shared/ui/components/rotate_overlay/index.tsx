import './style.less';
import { useIsMobile } from '@/controllers/interface/mobile';
import { t } from '@/i18n';

/**
 * The landscape lock a web page can actually enforce (user decision,
 * 2026-11-23: the game is landscape-only on phones). iOS Safari offers no
 * orientation lock to web pages, so while a touch device is held upright
 * this plate covers the game and asks for a sideways turn; the stylesheet
 * alone decides when it shows. On a desktop it is never mounted.
 */
export const RotateOverlay = () => {
  if (!useIsMobile()) return null;

  return (
    <div className="rotate-overlay">
      <div className="rotate-plate">
        <div className="rotate-phone" aria-hidden="true">
          <div className="rotate-phone-dot" />
        </div>
        <div className="rotate-line">{t('rotate.prompt')}</div>
      </div>
    </div>
  );
};
