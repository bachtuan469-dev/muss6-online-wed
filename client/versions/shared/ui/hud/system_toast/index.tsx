import './style.less';
import { observer } from 'mobx-react-lite';
import { SystemToast } from '@/modules/chat/systemToast';
import { useIsMobile } from '@/controllers/interface/mobile';

/**
 * The system-notification toast (FIX26 Viec 1): the current error line,
 * big and centred under the top row. Tap to dismiss, or it goes away on
 * its own after a few seconds. Touch devices only - on desktop the chat
 * log is the surface, and it stays visible there.
 */
export const SystemToastView = observer(() => {
  const mobile = useIsMobile();
  const current = SystemToast.current;
  if (!mobile || !current) return null;

  return (
    <div className="system-toast" role="status" onClick={() => SystemToast.dismiss()}>
      <span className="system-toast-text">{current.text}</span>
    </div>
  );
});
