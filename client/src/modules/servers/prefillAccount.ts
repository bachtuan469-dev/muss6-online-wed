/**
 * The account the web portal's "Choi ngay" link carries in `?account=`, so
 * the login window opens with that name already typed. No password travels
 * with it: the web stores only BCrypt hashes, so there is nothing to fill,
 * and a saved login token covers the password when one exists for the name.
 *
 * The bounds are the login name's own: `data."Account"."LoginName"` is
 * `varchar(10)`, and the web registers names from 3 characters
 * (`openmu-accounts.js`). A value outside them is ignored, not reported: a
 * bad deep link is not the player's typing to correct.
 */

/** ASCII letters and digits, 3 to 10 characters. */
const ACCOUNT_RE = /^[A-Za-z0-9]{3,10}$/;

/**
 * The account in `?account=`, or null when the URL carries none or one that
 * cannot be a login name. `search` is injectable so tests need no browser.
 */
export function accountFromUrl(
  search: string = typeof location === 'undefined' ? '' : location.search
): string | null {
  const raw = new URLSearchParams(search).get('account');
  if (!raw) return null;
  return ACCOUNT_RE.test(raw) ? raw : null;
}
