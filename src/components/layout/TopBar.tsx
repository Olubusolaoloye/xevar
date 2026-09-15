import { Menu, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Wordmark } from '@/components/brand/Logo';
import { DisplayMenu } from './DisplayMenu';

/**
 * The application header.
 *
 * Search dominates it deliberately — on a screener the search field *is* the
 * primary navigation, so it gets the widest element and the ⌘K shortcut rather
 * than being tucked into a corner.
 */
export function TopBar({
  onOpenSearch,
  onOpenNav,
}: {
  onOpenSearch: () => void;
  onOpenNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-3 backdrop-blur-xl sm:px-4">
      {/* Below `lg` the rail is off-canvas, so this is the only way to it.
          Above `lg` the rail is already on screen and the button would open a
          drawer duplicating it. */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="-ml-1 shrink-0 rounded-md p-2 text-ink-low transition-colors hover:bg-raised hover:text-ink lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      {/* The rail owns the wordmark on desktop; below `lg` it lives here.
          It survives the hamburger arriving beside it because the search
          field flexes — the brand is worth more than forty pixels of
          placeholder text. */}
      <NavLink to="/" className="shrink-0 lg:hidden" aria-label="PanScreener home">
        <Wordmark size="sm" />
      </NavLink>

      <button
        onClick={onOpenSearch}
        /* min-w-0 is load-bearing: a flex item will not shrink below its
           content's width without it, so on a 360px phone the placeholder
           text held the search field open and pushed the display menu off
           the right edge of the screen. */
        className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-line bg-sunken px-3 text-left transition-colors hover:border-line-strong sm:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0 text-ink-dim transition-colors group-hover:text-ink-low" />
        <span className="flex-1 truncate text-sm text-ink-dim">
          <span className="sm:hidden">Search…</span>
          <span className="hidden sm:inline">Search tokens, pairs, addresses…</span>
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded-xs border border-line-strong bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink-dim sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <DisplayMenu />
      </div>
    </header>
  );
}
