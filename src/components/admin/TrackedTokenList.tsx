import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/format';
import { CHAINS } from '@/data/chains';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import {
  CATEGORY_LABEL,
  isPinned,
  useRegistryStore,
  type TokenCategory,
  type TrackedToken,
} from '@/store/useRegistryStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChainChip } from '@/components/ui/ChainChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelHeader } from '@/components/ui/Panel';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { Tooltip } from '@/components/ui/Tooltip';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TokenCategory[];

function EditRow({ token, onDone }: { token: TrackedToken; onDone: () => void }) {
  const update = useRegistryStore((s) => s.update);
  const [label, setLabel] = useState(token.label ?? '');
  const [address, setAddress] = useState(token.address ?? '');
  const [category, setCategory] = useState<TokenCategory>(token.category);
  const [note, setNote] = useState(token.note ?? '');

  const save = () => {
    update(token.id, {
      label: label.trim() || undefined,
      // Pinning an address here is what upgrades a ticker guess into a
      // certainty, so it is the most valuable field on this form.
      address: address.trim() || undefined,
      category,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <div className="space-y-2.5 border-t border-line bg-sunken/40 px-4 py-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label htmlFor={`lbl-${token.id}`} className="mb-1 block text-[11px] text-ink-mid">
            Display name
          </label>
          <Input
            id={`lbl-${token.id}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={token.symbol}
          />
        </div>
        <div>
          <label htmlFor={`cat-${token.id}`} className="mb-1 block text-[11px] text-ink-mid">
            Category
          </label>
          <select
            id={`cat-${token.id}`}
            value={category}
            onChange={(e) => setCategory(e.target.value as TokenCategory)}
            className="h-9 w-full rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`addr-${token.id}`} className="mb-1 block text-[11px] text-ink-mid">
          Contract address{' '}
          <span className="text-ink-dim">
            — pin this to stop the ticker matching the wrong token
          </span>
        </label>
        <Input
          id={`addr-${token.id}`}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… or a Solana address"
          className="font-mono text-xs"
        />
      </div>

      <div>
        <label htmlFor={`note-${token.id}`} className="mb-1 block text-[11px] text-ink-mid">
          Note <span className="text-ink-dim">(optional)</span>
        </label>
        <Input
          id={`note-${token.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Why you're tracking it"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * The tracked-token list.
 *
 * Shows each entry beside what the live feed actually resolved it to, so a
 * mismatch is visible here rather than being discovered as a wrong price on the
 * board. Unpinned entries carry a warning: they were matched by ticker and
 * could be an impostor.
 */
export function TrackedTokenList() {
  const tokens = useRegistryStore((s) => s.tokens);
  const remove = useRegistryStore((s) => s.remove);
  const move = useRegistryStore((s) => s.move);
  const pairs = useMarketStore((s) => s.pairs);
  const { compact: money } = useCurrency();

  const [editing, setEditing] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...tokens].sort((a, b) => a.order - b.order),
    [tokens],
  );

  const unpinnedCount = ordered.filter((t) => !isPinned(t)).length;

  return (
    <div>
      <PanelHeader
        title="Tracked tokens"
        subtitle={`${ordered.length} on the board${unpinnedCount ? ` · ${unpinnedCount} unverified` : ''}`}
        icon={<ListChecks className="h-4 w-4" />}
      />

      {ordered.length === 0 ? (
        <EmptyState
          title="No tokens tracked"
          description="The board is empty until you add something. Search for a token above."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {ordered.map((token, index) => {
            const live = pairs.find((p) => p.tracked?.tokenId === token.id);
            const pinned = isPinned(token);

            return (
              <li key={token.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Reorder */}
                  <div className="flex shrink-0 flex-col">
                    <button
                      onClick={() => move(token.id, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${token.symbol} up`}
                      className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-ink disabled:opacity-25"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => move(token.id, 1)}
                      disabled={index === ordered.length - 1}
                      aria-label={`Move ${token.symbol} down`}
                      className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-ink disabled:opacity-25"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">
                        {token.symbol}
                      </span>
                      <ChainChip chain={token.chain} compact />
                      <Badge>{CATEGORY_LABEL[token.category]}</Badge>

                      {pinned ? (
                        <Tooltip content="Pinned to a contract address — this is certainly the right token.">
                          <Badge tone="up">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Verified
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Matched by ticker only. Another token could share this symbol — edit it and pin the contract address.">
                          <Badge tone="warn">
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Unverified
                          </Badge>
                        </Tooltip>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[11px] text-ink-low">
                      {token.label ?? CHAINS[token.chain].name}
                      {token.address && (
                        <span className="font-mono text-ink-dim">
                          {' · '}
                          {truncateAddress(token.address, 8, 6)}
                        </span>
                      )}
                    </p>

                    {/* What the feed actually resolved this to */}
                    <p className="mt-1 text-[11px]">
                      {live ? (
                        <span className="text-ink-mid">
                          Live on {live.dex} · Liq {money(live.liquidityUsd)}
                        </span>
                      ) : (
                        <span className="text-warn">
                          Not resolving — no pool found for this entry
                        </span>
                      )}
                    </p>
                  </div>

                  {live && (
                    <div className="hidden shrink-0 text-right sm:block">
                      <PriceText
                        usd={live.priceUsd}
                        live
                        className="block text-xs font-medium text-ink"
                      />
                      <ChangeValue value={live.change.h24} size="sm" />
                    </div>
                  )}

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => setEditing(editing === token.id ? null : token.id)}
                      aria-label={`Edit ${token.symbol}`}
                      className={cn(
                        'rounded-sm p-1.5 transition-colors',
                        editing === token.id
                          ? 'bg-raised text-ink'
                          : 'text-ink-dim hover:bg-raised hover:text-ink',
                      )}
                    >
                      {editing === token.id ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => remove(token.id)}
                      aria-label={`Stop tracking ${token.symbol}`}
                      className="rounded-sm p-1.5 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {editing === token.id && (
                  <EditRow token={token} onDone={() => setEditing(null)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
