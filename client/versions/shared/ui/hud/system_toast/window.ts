import { defineWindow } from '@/controllers/interface/windows';
import { SystemToastView } from '.';

export default defineWindow({
  id: 'system_toast',
  slot: 'hud',
  order: 355,
  component: SystemToastView,
});
