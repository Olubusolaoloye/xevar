import { describe, expect, it } from 'vitest';
import { isExemptPath, lockState } from './appLock';

const base = {
  locked: true,
  settingsReady: true,
  isAdmin: false,
  authReady: true,
  pathname: '/screener',
};

describe('lockState', () => {
  it('shows the app when the switch is off, whoever is asking', () => {
    expect(lockState({ ...base, locked: false })).toBe('open');
    expect(lockState({ ...base, locked: false, authReady: false })).toBe('open');
  });

  it('draws nothing until the switch itself is known', () => {
    /* The switch lives in the backend and lands after first paint. Rendering
       the app in the meantime shows a closed product in full — board and all —
       to exactly the person it is meant to shut out, then snaps away. */
    expect(lockState({ ...base, settingsReady: false })).toBe('checking');
    expect(lockState({ ...base, settingsReady: false, locked: false })).toBe('checking');
    expect(lockState({ ...base, settingsReady: false, isAdmin: true })).toBe('checking');
  });

  it('never waits on the routes that lift the lock', () => {
    // An operator during a backend outage must not land on a blank page.
    expect(lockState({ ...base, settingsReady: false, pathname: '/account' })).toBe('open');
    expect(lockState({ ...base, settingsReady: false, pathname: '/admin' })).toBe('open');
  });

  it('closes the app to an ordinary visitor', () => {
    expect(lockState(base)).toBe('closed');
  });

  it('lets the admin through', () => {
    expect(lockState({ ...base, isAdmin: true })).toBe('open');
  });

  it('waits rather than guessing while the session is still loading', () => {
    /* Assuming open would flash the product at somebody meant to be shut out;
       assuming closed would flash the closed sign at the admin on every load. */
    expect(lockState({ ...base, authReady: false })).toBe('checking');
  });

  it('keeps the way back in open even before the session resolves', () => {
    // Otherwise the switch is a trapdoor: the screen that lifts the lock sits
    // behind the lock, waiting on a session that signing in is the only way
    // to get.
    expect(lockState({ ...base, authReady: false, pathname: '/account' })).toBe('open');
    expect(lockState({ ...base, authReady: false, pathname: '/admin' })).toBe('open');
  });

  it('closes every other route, including deep links', () => {
    for (const pathname of ['/', '/screener', '/pair/bsc-0xabc', '/watchlist', '/multichart']) {
      expect(lockState({ ...base, pathname })).toBe('closed');
    }
  });
});

describe('isExemptPath', () => {
  it('covers children of an exempt route', () => {
    expect(isExemptPath('/admin')).toBe(true);
    expect(isExemptPath('/admin/anything')).toBe(true);
    expect(isExemptPath('/account')).toBe(true);
  });

  it('does not match a route that merely starts with the same letters', () => {
    // "/accounts-payable" is not "/account", and a prefix test without the
    // separator would have let it through.
    expect(isExemptPath('/accounts-payable')).toBe(false);
    expect(isExemptPath('/administrator')).toBe(false);
  });

  it('does not match an unrelated route', () => {
    expect(isExemptPath('/screener')).toBe(false);
    expect(isExemptPath('/')).toBe(false);
  });
});
