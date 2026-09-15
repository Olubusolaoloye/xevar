import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useMarketFeed } from '@/hooks/useMarketFeed';
import { useThemeEffect } from '@/hooks/useTheme';
import { startListingSync, stopListingSync } from '@/store/useListingStore';
import { startAdminSync, stopAdminSync } from '@/store/useAdminStore';
import { stopReviewSync } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminStore } from '@/store/useAdminStore';
import { lockState } from '@/data/appLock';
import { ComingSoon } from '@/pages/ComingSoon';
import { SideRail } from './SideRail';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { MobileDrawer } from './MobileDrawer';
import { CommandPalette } from './CommandPalette';
import { UpdateBanner } from './UpdateBanner';

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  const locked = useAdminStore((s) => s.locked);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authReady = useAuthStore((s) => s.ready);

  // One feed for the whole application, mounted at the shell.
  useMarketFeed();
  useThemeEffect();

  // Listings, adverts and settings come from the backend and stay in sync over
  // a websocket, so an admin edit on one device reaches every open browser
  // without anyone reloading.
  //
  // Auth starts here too, and that is a fix rather than tidying. init() sets
  // up the listener that tells the store a session exists, and it used to be
  // called only by the admin and developer screens — the two places that
  // happened to need it first. So signing in anywhere else, such as the
  // community panel on the compare page, authenticated the Supabase client
  // but never told the store: the form stayed on screen and nothing happened
  // until you reloaded or wandered onto the developer page. A session is
  // application state, so it is established where the application starts.
  useEffect(() => {
    useAuthStore.getState().init();
    startListingSync();
    startAdminSync();
    return () => {
      stopListingSync();
      stopAdminSync();
      // Reviews subscribe lazily, when a comparison asks for a token, so there
      // is no matching start() — only this teardown.
      stopReviewSync();
    };
  }, []);

  // ⌘K / Ctrl-K from anywhere, and `/` when not already typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '/' && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Every route change starts at the top; carrying scroll between a table and
  // a detail page is disorienting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  /* The closed sign, when the operator has thrown the switch.

     Rendered instead of the shell rather than inside it: a closed app that
     still draws navigation and a search field invites people to press things,
     and every one of those presses becomes a route that has to refuse them on
     its own. The hooks above still run, which is the point — the settings
     subscription is what tells this browser the moment the app reopens, with
     no reload.

     This is presentation only. The lock that holds is in Postgres, where the
     board is unreadable through the API while closed. See appLock.ts. */
  const lock = lockState({
    locked,
    isAdmin,
    authReady,
    pathname,
  });

  if (lock === 'closed') return <ComingSoon />;
  if (lock === 'checking') {
    // Neither the app nor the sign until the session resolves; showing either
    // one flashes the wrong thing at somebody.
    return <div className="min-h-screen bg-canvas" />;
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <SideRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenNav={() => setNavOpen(true)}
        />

        {/* A closed app looks identical to an open one once you are the admin,
            which is how an operator locks it on a Friday and spends Monday
            wondering where the traffic went. */}
        {locked && isAdmin && (
          <Link
            to="/admin"
            className="flex items-center justify-center gap-2 bg-warn/12 px-4 py-1.5 text-center text-[11px] font-medium text-warn transition-colors hover:bg-warn/20"
          >
            <Lock className="h-3 w-3 shrink-0" />
            The app is closed to everyone but you. Reopen it in admin.
          </Link>
        )}

        {/* Bottom padding clears the mobile tab bar. */}
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <MobileDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <UpdateBanner />
    </div>
  );
}
