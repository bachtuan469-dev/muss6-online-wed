/**
 * One floating potion icon's tap, split across its two pointer events.
 * Pointer down with a carried potion binds the slot to that kind (the
 * bar's own drop); pointer up drinks - but never on the tap that just
 * bound, so one tap cannot bind and drink at once.
 */
export function potionTapDown(
  picked: boolean,
  canBind: boolean,
  bind: () => void
): boolean {
  if (!picked || !canBind) return false;
  bind();
  return true;
}

export function potionTapUp(bound: boolean, drink: () => void): void {
  if (bound) return;
  drink();
}
