import { Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Wordmark } from '@/components/brand/Logo';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePrefsStore, type Currency } from '@/store/usePrefsStore';
import { ThemeToggle } from './ThemeToggle';

const CURRENCIES = [
  { value: 'USD' as Currency, label: '$' , title: 'US Dollar' },
  { value: 'EUR' as Currency, label: '€', title: 'Euro' },
  { value: 'GBP' as Currency, label: '£', title: 'Pound Sterling' },
  { value: 'NGN' as Currency, label: '₦', title: 'Nigerian Naira' },
] as const;

/**
 * The application header.
 *
 * Search dominates it deliberately — on a screener the search field *is* the
 * primary navigation, so it gets the widest element and the ⌘K shortcut rather
 * than being tucked into a corner.
 */
export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const currency = usePrefsStore((s) => s.currency);
  const setCurrency = usePrefsStore((s) => s.setCurrency);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-3 backdrop-blur-xl sm:px-4">
      {/* The rail owns the wordmark on desktop; below `lg` it lives here. */}
      <NavLink to="/" className="lg:hidden" aria-label="PanScreener home">
        <Wordmark size="sm" />
      </NavLink>

      <button
        onClick={onOpenSearch}
        className="group flex h-9 flex-1 items-center gap-2.5 rounded-md border border-line bg-sunken px-3 text-left transition-colors hover:border-line-strong sm:max-w-md"
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
        <ThemeToggle className="hidden sm:inline-flex" />
        <SegmentedControl
          options={CURRENCIES}
          value={currency}
          onChange={setCurrency}
          size="sm"
        />
      </div>
    </header>
  );
}
