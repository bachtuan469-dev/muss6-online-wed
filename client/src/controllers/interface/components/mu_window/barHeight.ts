import { MuWindows } from '../../windowManager';

// The main bar's height in 640x480 units; the bar is scaled by the player, so
// every window that rides on it (the original's `480 - 51 - h`) follows the
// bar's on-screen height, not the constant. Lives here, not in `index.tsx`,
// so `useWindowChrome` can read it without importing the window chrome
// module (which would be a cycle: `index.tsx` uses that hook).
const BOTTOM_BAR_HEIGHT = 51;
export const BOTTOM_BAR_ID = 'bottom-bar';
export const bottomBarScreenHeight = () => BOTTOM_BAR_HEIGHT * MuWindows.scaleOf(BOTTOM_BAR_ID);
