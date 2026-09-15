/**
 * Closing the app.
 *
 * One admin switch puts the whole product behind a "coming soon" screen. This
 * module holds the decision — whether a given visitor, on a given route, sees
 * the app or the closed sign — so it can be reasoned about and tested in one
 * place rather than inferred from conditions scattered through the shell.
 *
 * Worth being clear about what this file is and is not. It is presentation.
 * The bundle ships to the browser and the publishable key ships with it, so
 * anybody determined enough can edit the JavaScript or call the API directly.
 * The lock that actually holds is in Postgres: while the app is closed the
 * board, the adverts and the reviews are unreadable through the API for
 * everyone but the admin. See supabase/005_app_lock.sql. This decides what to
 * draw; that decides what exists.
 */

/**
 * Routes that stay open while the app is closed.
 *
 * Without these the switch is a trapdoor: the admin signs out, the app is
 * closed to them too, and the screen that would let them sign back in and
 * reopen it is behind the very lock they are trying to lift. Neither route
 * shows market data — one is a sign-in form, the other is the admin screen,
 * which has its own gate.
 */
export const LOCK_EXEMPT_PATHS = ['/admin', '/account'] as const;

export type LockState =
  /** Show the app. */
  | 'open'
  /** Show the closed screen. */
  | 'closed'
  /**
   * Not known yet.
   *
   * A third state rather than a guess in either direction. Assuming open
   * flashes the product at somebody who is meant to be shut out; assuming
   * closed flashes the closed sign at the admin on every page load. The shell
   * waits instead.
   */
  | 'checking';

export interface LockInput {
  /** The operator's switch, as read from app settings. */
  locked: boolean;
  isAdmin: boolean;
  /** Whether the session lookup has finished — `isAdmin` is meaningless until it has. */
  authReady: boolean;
  pathname: string;
}

export function lockState({ locked, isAdmin, authReady, pathname }: LockInput): LockState {
  if (!locked) return 'open';

  // Checked before `authReady`: these routes are how an admin gets back in,
  // so they must not sit behind a spinner waiting for a session that signing
  // in is the only way to obtain.
  if (isExemptPath(pathname)) return 'open';

  if (!authReady) return 'checking';
  return isAdmin ? 'open' : 'closed';
}

/** Whether a path is one of the always-open routes, including its children. */
export function isExemptPath(pathname: string): boolean {
  return LOCK_EXEMPT_PATHS.some(
    (exempt) => pathname === exempt || pathname.startsWith(`${exempt}/`),
  );
}

export const DEFAULT_LOCK_TITLE = 'Coming soon';
export const DEFAULT_LOCK_MESSAGE =
  'PanScreener is being prepared. Check back shortly.';
