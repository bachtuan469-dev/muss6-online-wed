import { defineImprovement } from '@/controllers/fidelity';

/**
 * The touch control set over the world: a stick at the lower left that walks the hero, and the
 * learned skills in a row at the lower right; a tap on a monster attacks it, the way a mouse
 * click does on a PC. Classic: the original is a keyboard and mouse client and draws no
 * on-screen controls; the mouse and the bottom bar do everything. Read in
 * `versions/shared/ui/hud/mobile_controls`.
 */
export default defineImprovement({
  id: 'touchControls',
  preset: 'enhanced',
  labelKey: 'fidelity.touchControls',
  hintKey: 'fidelity.touchControls.hint',
});
