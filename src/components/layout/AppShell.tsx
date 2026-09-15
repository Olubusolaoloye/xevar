import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMarketFeed } from '@/hooks/useMarketFeed';
import { useThemeEffect } from '@/hooks/useTheme';
import { startListingSync, stopListingSync } from '@/store/useListingStore';
import { startAdminSync, stopAdminSync } from '@/store/useAdminStore';
import { stopReviewSync } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SideRail } from './SideRail';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { UpdateBanner } from './UpdateBanner';

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();

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

  return (
    <div className="flex min-h-screen bg-canvas">
      <SideRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSearch={() => setPaletteOpen(true)} />

        {/* Bottom padding clears the mobile tab bar. */}
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <UpdateBanner />
    </div>
  );
}
