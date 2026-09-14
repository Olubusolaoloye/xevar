import { useMemo } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact } from '@/lib/format';
import { CHAIN_LIST, CHAINS } from '@/data/chains';
import { activeFilterCount } from '@/data/query';
import { useScreenerStore } from '@/store/useScreenerStore';
import { useMarketStore } from '@/store/useMarketStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { ScreenerFilters, ScreenerQuery } from '@/data/types';

/** Thresholds offered as one-tap choices rather than free-text entry. */
const LIQUIDITY_STEPS = [10_000, 50_000, 250_000, 1_000_000];
const VOLUME_STEPS = [50_000, 250_000, 1_000_000, 10_000_000];
const AGE_STEPS: Array<{ label: string; hours: number }> = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-4 py-3.5 last:border-b-0">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * A filter value rendered as a toggle chip.
 *
 * Every threshold in this rail is "click to apply, click again to clear" — a
 * filter you cannot remove as easily as you applied it is a trap, and numeric
 * text inputs for liquidity are far slower than four sensible presets.
 */
function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-sm border px-2 py-1 text-[11px] font-medium transition-all duration-150',
        active
          ? 'border-brand-500/40 bg-brand-500/12 text-brand-500'
          : 'border-line bg-sunken text-ink-low hover:border-line-strong hover:text-ink-mid',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function FilterRail({ query, className }: { query: ScreenerQuery; className?: string }) {
  const toggleChain = useScreenerStore((s) => s.toggleChain);
  const toggleDex = useScreenerStore((s) => s.toggleDex);
  const setFilter = useScreenerStore((s) => s.setFilter);
  const resetFilters = useScreenerStore((s) => s.resetFilters);
  const pairs = useMarketStore((s) => s.pairs);

  /**
   * The exchanges actually present on the board.
   *
   * Derived rather than hardcoded: a fixed list offers filters for venues that
   * may return nothing, and goes stale the moment a new DEX matters. An empty
   * board simply shows no exchange filter, which is the truthful answer.
   */
  const dexes = useMemo(
    () => Array.from(new Set(pairs.map((p) => p.dex))).sort(),
    [pairs],
  );

  const count = activeFilterCount(query);

  /** Apply a threshold, or clear it when the active value is clicked again. */
  const toggleThreshold = <K extends keyof ScreenerFilters>(
    key: K,
    value: ScreenerFilters[K],
  ) => {
    setFilter(key, (query[key] === value ? null : value) as ScreenerFilters[K]);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4 text-ink-low" />
          Filters
          {count > 0 && <Badge tone="brand">{count}</Badge>}
        </p>
        {count > 0 && (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <RotateCcw className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <Section title="Networks">
        <div className="flex flex-wrap gap-1.5">
          {CHAIN_LIST.map((chain) => {
            const active = query.chains.includes(chain.id);
            return (
              <button
                key={chain.id}
                onClick={() => toggleChain(chain.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1',
                  'text-[11px] font-medium transition-all duration-150',
                  active
                    ? 'text-ink'
                    : 'border-line bg-sunken text-ink-low hover:border-line-strong hover:text-ink-mid',
                )}
                style={
                  active
                    ? {
                        borderColor: `color-mix(in srgb, ${chain.colorVar} 40%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${chain.colorVar} 14%, transparent)`,
                      }
                    : undefined
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: chain.colorVar }}
                />
                {chain.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Min liquidity">
        <div className="flex flex-wrap gap-1.5">
          {LIQUIDITY_STEPS.map((value) => (
            <Chip
              key={value}
              active={query.minLiquidity === value}
              onClick={() => toggleThreshold('minLiquidity', value)}
            >
              {formatCompact(value, '$')}+
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Min 24h volume">
        <div className="flex flex-wrap gap-1.5">
          {VOLUME_STEPS.map((value) => (
            <Chip
              key={value}
              active={query.minVolume24h === value}
              onClick={() => toggleThreshold('minVolume24h', value)}
            >
              {formatCompact(value, '$')}+
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Max age">
        <div className="flex flex-wrap gap-1.5">
          {AGE_STEPS.map((step) => (
            <Chip
              key={step.hours}
              active={query.maxAgeHours === step.hours}
              onClick={() => toggleThreshold('maxAgeHours', step.hours)}
            >
              &lt; {step.label}
            </Chip>
          ))}
        </div>
      </Section>

      {dexes.length > 0 && (
        <Section title="Exchanges">
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {dexes.map((dex) => (
              <Chip
                key={dex}
                active={query.dexes.includes(dex)}
                onClick={() => toggleDex(dex)}
              >
                {dex}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <div className="px-4 py-3">
        <p className="text-[11px] leading-relaxed text-ink-dim">
          Contract verdicts come from an external provider, linked on each token
          page. Always verify a contract yourself before trading it.
        </p>
      </div>
    </div>
  );
}

/** Which chains currently have a filter applied — used by the mobile summary. */
export function activeChainNames(query: ScreenerQuery): string {
  if (query.chains.length === 0) return 'All networks';
  return query.chains.map((id) => CHAINS[id].name).join(', ');
}
