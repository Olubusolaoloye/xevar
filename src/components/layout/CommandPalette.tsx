import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';
import { useMarketStore } from '@/store/useMarketStore';
import type { Pair } from '@/data/types';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { NAV_ITEMS } from './navigation';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Result =
  | { kind: 'page'; id: string; label: string; hint: string; path: string }
  | { kind: 'pair'; id: string; path: string; pair: Pair };

/**
 * Global search, on ⌘K.
 *
 * A screener is a search-first product: the fastest path to any pair should be
 * typing its ticker, not navigating to a page and filtering. Pages and pairs
 * share one result list so a single keystroke reaches either.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const pairs = useMarketStore((s) => s.pairs);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset and focus every time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();

    const pages: Result[] = NAV_ITEMS.filter(
      (item) => !q || item.label.toLowerCase().includes(q),
    ).map((item) => ({
      kind: 'page',
      id: `page:${item.path}`,
      label: item.label,
      hint: item.hint,
      path: item.path,
    }));

    // With no query, show the trending board as a useful default rather than
    // an empty panel.
    const candidates = q
      ? pairs.filter(
          (pair) =>
            pair.baseToken.symbol.toLowerCase().includes(q) ||
            pair.baseToken.name.toLowerCase().includes(q) ||
            pair.baseToken.address.toLowerCase().includes(q),
        )
      : pairs.filter((pair) => pair.trendingRank);

    const matches: Result[] = candidates
      .sort((a, b) => {
        if (q) return b.volume.h24 - a.volume.h24;
        return (a.trendingRank ?? 99) - (b.trendingRank ?? 99);
      })
      .slice(0, 8)
      .map((pair) => ({ kind: 'pair', id: `pair:${pair.id}`, path: `/pair/${pair.id}`, pair }));

    return [...pages, ...matches];
  }, [query, pairs]);

  // Keep the cursor inside the result list as it shrinks while typing.
  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => (c + 1) % Math.max(1, results.length));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length));
      }
      if (event.key === 'Enter') {
        const target = results[cursor];
        if (target) {
          navigate(target.path);
          onClose();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, cursor, navigate, onClose]);

  // Keep the highlighted row scrolled into view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-popover rise"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tokens, pairs, contract addresses…"
            className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-ink-dim focus:outline-none"
          />
          <kbd className="shrink-0 rounded-xs border border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-ink-low">
              Nothing matches “{query}”.
            </p>
          )}

          {results.map((result, index) => {
            const active = index === cursor;
            const isFirstPair =
              result.kind === 'pair' && results[index - 1]?.kind !== 'pair';

            return (
              <div key={result.id}>
                {isFirstPair && (
                  <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
                    {query ? 'Pairs' : 'Trending now'}
                  </p>
                )}

                <button
                  data-index={index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => {
                    navigate(result.path);
                    onClose();
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-raised' : 'hover:bg-raised/60',
                  )}
                >
                  {result.kind === 'page' ? (
                    <>
                      <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-line bg-sunken text-[10px] font-bold uppercase text-ink-low">
                        {result.label.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {result.label}
                        </span>
                        <span className="block truncate text-xs text-ink-low">
                          {result.hint}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <TokenAvatar
                        symbol={result.pair.baseToken.symbol}
                        chain={result.pair.chain}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink">
                            {result.pair.baseToken.symbol}
                          </span>
                          <span className="text-xs text-ink-dim">
                            /{result.pair.quoteToken.symbol}
                          </span>
                          <ChainChip chain={result.pair.chain} compact />
                        </span>
                        <span className="block truncate text-xs text-ink-low">
                          {result.pair.dex} · Liq {formatCompact(result.pair.liquidityUsd, '$')}
                        </span>
                      </span>
                      <ChangeValue value={result.pair.change.h24} size="sm" />
                    </>
                  )}

                  {active && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[10px] text-ink-dim">
          <span className="flex items-center gap-1">
            <kbd className="rounded-xs border border-line-strong bg-sunken px-1 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded-xs border border-line-strong bg-sunken px-1 font-mono">↵</kbd>
            open
          </span>
        </div>
      </div>
    </div>
  );
}
