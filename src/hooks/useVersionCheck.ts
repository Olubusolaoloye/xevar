import { useCallback, useEffect, useState } from 'react';

/**
 * Notice when a newer build has been deployed.
 *
 * GitHub Pages serves index.html with a ten-minute cache and offers no way to
 * override it — a static host reads no config we can ship. Because asset
 * filenames are content-hashed, a stale index.html keeps requesting the
 * previous bundle, which is still on the server, so a visitor can sit on an old
 * build long after a deploy and have no idea.
 *
 * The fix is to make the app notice for itself: the build's id is compiled in,
 * and a small version file on the server is polled and compared. A mismatch
 * means the tab is running yesterday's code.
 *
 * The reload is offered rather than forced. Reloading out from under someone
 * mid-form, mid-calculation or mid-edit to deliver a cosmetic change is a worse
 * outcome than the stale build.
 */
const POLL_MS = 120_000;

export function useVersionCheck() {
  const [updateReady, setUpdateReady] = useState(false);

  const check = useCallback(async () => {
    try {
      // Cache-bust the check itself, or the poll would be served from the same
      // stale cache it is meant to detect.
      const response = await fetch(
        `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;

      const { buildId } = (await response.json()) as { buildId?: string };
      // A local build has no meaningful id to compare against.
      if (!buildId || buildId === 'dev' || __BUILD_ID__ === 'dev') return;
      if (buildId !== __BUILD_ID__) setUpdateReady(true);
    } catch {
      // Offline or the file is missing — nothing to do, and nothing worth
      // telling the user about.
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, POLL_MS);

    // Returning to a tab left open overnight is the most likely moment to be
    // looking at a stale build.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { updateReady, reload, buildId: __BUILD_ID__ };
}
