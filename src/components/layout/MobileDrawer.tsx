import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';
import { RailFooter, RailLinks } from './RailNav';

/**
 * Off-canvas navigation for phones and tablets.
 *
 * The bottom tab bar holds five primary routes and nothing else, which left
 * Sections, Settings, the developer screen and the account with no way in at
 * all below `lg`. This is that way in: the same list the desktop rail shows,
 * slid over the page.
 *
 * Both stay. The tab bar is one thumb-reach from the primary destinations and
 * a drawer would be two, so replacing it would make the common case worse to
 * fix the uncommon one.
 */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Any navigation closes it. Links call onClose themselves, but the browser's
  // back button and the command palette also change the route, and a drawer
  // left standing over a page the user has already moved on from is a trap.
  useEffect(() => {
    onClose();
    // Deliberately keyed on the path alone: including onClose would fire this
    // whenever the parent re-rendered and slam the drawer shut on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll while the drawer is over it — otherwise
    // a swipe on the backdrop moves the page and the drawer stays put.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus moves in, so a keyboard or screen-reader user is inside the thing
    // that just opened rather than still somewhere behind it.
    const restoreTo = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="drawer-veil absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="drawer-panel relative flex h-full w-[272px] max-w-[85vw] flex-col border-r border-line bg-surface outline-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
          <NavLink to="/" aria-label="PanScreener home" onClick={onClose}>
            <Wordmark size="sm" />
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 text-ink-low transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <RailLinks onNavigate={onClose} />
        </nav>

        <div className="space-y-0.5 border-t border-line px-2.5 py-3">
          <RailFooter onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
