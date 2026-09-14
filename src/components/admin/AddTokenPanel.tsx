import { useState } from 'react';
import { Check, Loader2, Plus, Search, ShieldAlert } from 'lucide-react';
import { formatCompact, truncateAddress } from '@/lib/format';
import { CHAIN_LIST } from '@/data/chains';
import { useTokenSearch } from '@/hooks/useTokenSearch';
import {
  CATEGORY_LABEL,
  useRegistryStore,
  type TokenCategory,
} from '@/store/useRegistryStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChainChip } from '@/components/ui/ChainChip';
import { PriceText } from '@/components/ui/PriceText';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { PanelHeader } from '@/components/ui/Panel';
import type { ChainId, Pair } from '@/data/types';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TokenCategory[];

/**
 * Add a token to the board.
 *
 * Search-first by design. Typing a ticker and saving it would be faster, but a
 * ticker is not an identity — anyone can deploy a token called WKC. Picking
 * from live results captures the contract address, which pins the entry to one
 * specific asset that cannot later resolve to an impostor.
 */
export function AddTokenPanel() {
  const add = useRegistryStore((s) => s.add);

  const [query, setQuery] = useState('');
  const [chain, setChain] = useState<ChainId | ''>('');
  const [category, setCategory] = useState<TokenCategory>('meme');
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { results, loading, error: searchError } = useTokenSearch(
    query,
    chain || undefined,
  );

  const addFromResult = (pair: Pair) => {
    const result = add({
      chain: pair.chain,
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      label: pair.baseToken.name,
      category,
      // Pin the pool too: the deepest today may not be the deepest tomorrow,
      // and a board that silently switches pools looks like a price glitch.
      pairAddress: pair.pairAddress,
    });

    if (!result.ok) {
      setError(result.error ?? 'Could not add that token.');
      return;
    }
    setError(null);
    setAdded(pair.baseToken.address);
    setTimeout(() => setAdded(null), 2000);
  };

  return (
    <div>
      <PanelHeader
        title="Add a token"
        subtitle="Search live markets and pick the real contract"
        icon={<Plus className="h-4 w-4" />}
      />

      <div className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="admin-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticker, name or contract address…"
            icon={<Search className="h-3.5 w-3.5" />}
            className="flex-1"
          />

          <select
            id="admin-chain"
            aria-label="Filter by network"
            value={chain}
            onChange={(event) => setChain(event.target.value as ChainId | '')}
            className="h-9 rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
          >
            <option value="">All networks</option>
            {CHAIN_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            id="admin-category"
            aria-label="Category for added tokens"
            value={category}
            onChange={(event) => setCategory(event.target.value as TokenCategory)}
            className="h-9 rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}
        {searchError && (
          <p className="rounded-sm border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
            {searchError}
          </p>
        )}

        {loading && (
          <p className="flex items-center gap-2 px-1 py-3 text-xs text-ink-low">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </p>
        )}

        {!loading && query.trim().length >= 2 && results.length === 0 && !searchError && (
          <p className="px-1 py-3 text-xs text-ink-low">
            Nothing matches “{query}”
            {chain ? ' on that network' : ''}. Try the contract address, which
            always resolves exactly.
          </p>
        )}

        {results.length > 0 && (
          <ul className="divide-y divide-line-soft overflow-hidden rounded-md border border-line">
            {results.map((pair) => (
              <li
                key={`${pair.chain}-${pair.baseToken.address}`}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <TokenAvatar
                  symbol={pair.baseToken.symbol}
                  chain={pair.chain}
                  src={pair.imageUrl}
                  size="sm"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">
                      {pair.baseToken.symbol}
                    </span>
                    <ChainChip chain={pair.chain} compact />
                    <span className="truncate text-[11px] text-ink-low">
                      {pair.baseToken.name}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-dim">
                    {truncateAddress(pair.baseToken.address, 10, 6)} · {pair.dex} ·
                    Liq {formatCompact(pair.liquidityUsd, '$')}
                  </p>
                </div>

                <PriceText
                  usd={pair.priceUsd}
                  className="hidden shrink-0 text-xs text-ink-mid sm:block"
                />

                <Button
                  size="sm"
                  variant={added === pair.baseToken.address ? 'primary' : 'outline'}
                  onClick={() => addFromResult(pair)}
                  className="shrink-0"
                >
                  {added === pair.baseToken.address ? (
                    <>
                      <Check className="h-3 w-3" />
                      Added
                    </>
                  ) : (
                    'Track'
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
          Anyone can deploy a token with any ticker. Check the contract address
          and liquidity against a source you trust before tracking it. Entries
          marked “unverified” were matched by ticker alone and could resolve to
          a different token.
        </p>
      </div>
    </div>
  );
}
