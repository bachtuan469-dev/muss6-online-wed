import { makeAutoObservable } from 'mobx';

/**
 * The system-notification toast (FIX26 Viec 1): every line that reaches
 * the log as an `Error` also pops here, big and centred, for a few seconds.
 * The log alone is invisible on a phone whenever a window is open; the
 * toast the client once had for these lines was retired and nothing
 * replaced it, so most system notifications were never seen. Details in
 * the chat module readme.
 */

export const SYSTEM_TOAST_MS = 4000;

export type SystemToastKind = 'error';

export const SystemToast = new (class _SystemToast {
  current: { text: string; kind: SystemToastKind } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable<this, 'timer'>(this, { timer: false });
  }

  /** Shows the line, replacing whatever is showing and restarting the clock. */
  show(text: string, kind: SystemToastKind = 'error'): void {
    if (!text) return;
    this.current = { text, kind };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), SYSTEM_TOAST_MS);
  }

  dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.current = null;
  }
})();
