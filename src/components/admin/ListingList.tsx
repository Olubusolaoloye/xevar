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
  listingBackend,
  CATEGORY_LABEL,
  isPinned,
  useListingStore,
  type TokenCategory,
  type Listing,
} from '@/store/useListingStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { ChainChip } from '@/components/ui/ChainChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelHeader } from '@/components/ui/Panel';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { Tooltip } from '@/components/ui/Tooltip';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TokenCategory[];

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-ink-mid">
        {label} {hint && <span className="text-ink-dim">— {hint}</span>}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={mono ? 'font-mono text-xs' : undefined}
      />
    </div>
  );
}

/**
 * Full manual control over one listing.
 *
 * Everything presentational is overridable, because providers get token
 * metadata wrong constantly — missing logos, truncated names, junk
 * descriptions — and an operator needs the last word on how a listing looks.
 *
 * Prices, liquidity and volume are deliberately absent. Those come from the
 * pool, and an editable price field would be a fabrication tool.
 */
function EditRow({ token, onDone }: { token: Listing; onDone: () => void }) {
  const update = listingBackend.update;

  const [draft, setDraft] = useState({
    label: token.label ?? '',
    address: token.address ?? '',
    pairAddress: token.pairAddress ?? '',
    category: token.category,
    logoUrl: token.logoUrl ?? '',
    coverUrl: token.coverUrl ?? '',
    blurb: token.blurb ?? '',
    website: token.website ?? '',
    twitter: token.twitter ?? '',
    telegram: token.telegram ?? '',
    note: token.note ?? '',
    featured: Boolean(token.featured),
    verified: Boolean(token.verified),
    approved: token.status === 'approved',
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const clean = (v: string) => v.trim() || undefined;
    update(token.id, {
      label: clean(draft.label),
      address: clean(draft.address),
      pairAddress: clean(draft.pairAddress),
      category: draft.category,
      logoUrl: clean(draft.logoUrl),
      coverUrl: clean(draft.coverUrl),
      blurb: clean(draft.blurb),
      website: clean(draft.website),
      twitter: clean(draft.twitter),
      telegram: clean(draft.telegram),
      note: clean(draft.note),
      featured: draft.featured,
      verified: draft.verified,
      // Admin autolisting: approving here publishes whatever presentation the
      // listing carries without waiting on a payment, which is the operator's
      // prerogative. Turning it off drops the listing back to tracking-only.
      status: draft.approved ? 'approved' : 'tracking',
    });
    onDone();
  };

  return (
    <div className="space-y-3 border-t border-line bg-sunken/40 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
        Identity
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field
          id={`lbl-${token.id}`}
          label="Display name"
          value={draft.label}
          onChange={(v) => set('label', v)}
          placeholder={token.symbol}
        />
        <div>
          <label htmlFor={`cat-${token.id}`} className="mb-1 block text-[11px] text-ink-mid">
            Category
          </label>
          <select
            id={`cat-${token.id}`}
            value={draft.category}
            onChange={(e) => set('category', e.target.value as TokenCategory)}
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

      <Field
        id={`addr-${token.id}`}
        label="Contract address"
        hint="pin this to stop the ticker matching the wrong token"
        value={draft.address}
        onChange={(v) => set('address', v)}
        placeholder="0x… or a Solana address"
        mono
      />
      <Field
        id={`pair-${token.id}`}
        label="Pool address"
        hint="optional; otherwise the deepest pool is used"
        value={draft.pairAddress}
        onChange={(v) => set('pairAddress', v)}
        mono
      />

      <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
        Presentation
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field
          id={`logo-${token.id}`}
          label="Logo URL"
          hint="overrides the provider's"
          value={draft.logoUrl}
          onChange={(v) => set('logoUrl', v)}
          placeholder="https://…"
        />
        <Field
          id={`cover-${token.id}`}
          label="Cover image URL"
          hint="wide banner"
          value={draft.coverUrl}
          onChange={(v) => set('coverUrl', v)}
          placeholder="https://…"
        />
      </div>

      {(draft.logoUrl || draft.coverUrl) && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-2.5">
          {draft.logoUrl && (
            <img
              src={draft.logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10"
            />
          )}
          {draft.coverUrl && (
            <img
              src={draft.coverUrl}
              alt=""
              className="h-10 min-w-0 flex-1 rounded-sm object-cover"
            />
          )}
          <span className="shrink-0 text-[10px] text-ink-dim">Preview</span>
        </div>
      )}

      <Field
        id={`blurb-${token.id}`}
        label="Description"
        value={draft.blurb}
        onChange={(v) => set('blurb', v)}
        placeholder="A sentence about the token"
      />

      <div className="grid gap-2.5 sm:grid-cols-3">
        <Field
          id={`web-${token.id}`}
          label="Website"
          value={draft.website}
          onChange={(v) => set('website', v)}
          placeholder="https://…"
        />
        <Field
          id={`tw-${token.id}`}
          label="X / Twitter"
          value={draft.twitter}
          onChange={(v) => set('twitter', v)}
          placeholder="https://x.com/…"
        />
        <Field
          id={`tg-${token.id}`}
          label="Telegram"
          value={draft.telegram}
          onChange={(v) => set('telegram', v)}
          placeholder="https://t.me/…"
        />
      </div>

      <Field
        id={`note-${token.id}`}
        label="Internal note"
        hint="not shown publicly"
        value={draft.note}
        onChange={(v) => set('note', v)}
      />

      <Toggle
        checked={draft.featured}
        onChange={(v) => set('featured', v)}
        label="Feature this listing"
        description="Pins it to the top of the board regardless of the active sort."
      />

      <Toggle
        checked={draft.approved}
        onChange={(v) => set('approved', v)}
        label="Publish details (autolist)"
        description="Shows the logo, banner, description and links above. Off means the token is tracked but presents market data only — which is what an unpaid listing looks like."
      />

      <Toggle
        checked={draft.verified}
        onChange={(v) => set('verified', v)}
        label="Verified"
        description="Your assertion that this is the project it claims to be. Separate from publishing details, and a stronger claim — a visitor reads the badge as you vouching for it."
      />

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={save}>
          Save listing
        </Button>
      </div>
    </div>
  );
}

/**
 * The listing.
 *
 * Shows each entry beside what the live feed actually resolved it to, so a
 * mismatch is visible here rather than being discovered as a wrong price on the
 * board. Unpinned entries carry a warning: they were matched by ticker and
 * could be an impostor.
 */
export function ListingList() {
  const tokens = useListingStore((s) => s.tokens);
  const remove = listingBackend.remove;
  const move = listingBackend.move;
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
        title="Listings"
        subtitle={`${ordered.length} listed${unpinnedCount ? ` · ${unpinnedCount} unverified` : ''}`}
        icon={<ListChecks className="h-4 w-4" />}
      />

      {ordered.length === 0 ? (
        <EmptyState
          title="No tokens listed"
          description="Nothing is listed yet. Search for a token above to list it."
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
                      aria-label={`Delist ${token.symbol}`}
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
