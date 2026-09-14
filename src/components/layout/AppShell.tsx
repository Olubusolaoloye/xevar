import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMarketFeed } from '@/hooks/useMarketFeed';
import { useThemeEffect } from '@/hooks/useTheme';
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
