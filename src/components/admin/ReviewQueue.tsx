import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Inbox, XCircle } from 'lucide-react';
import { CHAINS } from '@/data/chains';
import { formatAge } from '@/lib/format';
import { LISTING_FEE_USD, LISTING_PAYMENT_ADDRESS } from '@/data/listingStatus';
import { useListingStore, type Listing } from '@/store/useListingStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';

/**
 * Submissions waiting on a decision.
 *
 * The one job here is to make the payment checkable without leaving the page:
 * the transaction hash links straight to the chain's explorer, beside the
 * address it should have been sent to and the amount it should have carried.
 * Approving is an assertion that someone looked.
 */
export function ReviewQueue() {
  const tokens = useListingStore((s) => s.tokens);
  const update = useListingStore((s) => s.update);

  const pending = tokens.filter((t) => t.status === 'pending');

  return (
    <div>
      <PanelHeader
        title="Review queue"
        subtitle={pending.length === 0 ? 'Nothing waiting' : `${pending.length} waiting`}
        icon={<Inbox className="h-4 w-4" />}
      />

      {pending.length === 0 ? (
        <EmptyState
          title="No submissions to review"
          description="Developer submissions arrive here once a payment hash has been sent."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {pending.map((listing) => (
            <ReviewRow key={listing.id} listing={listing} onDecide={update} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({
  listing,
  onDecide,
}: {
  listing: Listing;
  onDecide: (id: string, patch: Partial<Listing>) => void;
}) {
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const chain = CHAINS[listing.chain];

  const approve = () =>
    onDecide(listing.id, {
      status: 'approved',
      // Approving publishes the submitted presentation. Verification is a
      // separate, stronger claim — that this is the project it says it is —
      // so it stays a deliberate second action rather than riding along.
      reviewNote: undefined,
    });

  const reject = () => {
    onDecide(listing.id, {
      status: 'rejected',
      reviewNote: note.trim() || 'The payment could not be confirmed.',
    });
    setRejecting(false);
    setNote('');
  };

  return (
    <li className="space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{listing.symbol}</span>
          <Badge>{chain.name}</Badge>
          {listing.submittedAt && (
            <span className="text-[11px] text-ink-dim">
              {formatAge(listing.submittedAt)} ago
            </span>
          )}
        </span>
      </div>

      {listing.contactEmail && (
        <p className="text-[11px] text-ink-low">
          From <span className="font-mono text-ink-mid">{listing.contactEmail}</span>
        </p>
      )}

      {/* The payment, laid out so it can actually be checked. */}
      <div className="space-y-1.5 rounded-md border border-line bg-sunken px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-ink-low">Expected</span>
          <span className="font-mono text-ink-mid">${LISTING_FEE_USD}</span>
        </p>
        <p className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="shrink-0 text-ink-low">To</span>
          <span className="truncate font-mono text-ink-dim" title={LISTING_PAYMENT_ADDRESS}>
            {LISTING_PAYMENT_ADDRESS}
          </span>
        </p>
        {listing.paymentTxHash && (
          <div className="flex items-center gap-1.5 border-t border-line pt-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-mid">
              {listing.paymentTxHash}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(listing.paymentTxHash ?? '')}
              aria-label="Copy transaction hash"
              className="rounded-sm p-0.5 text-ink-dim transition-colors hover:text-ink"
            >
              <Copy className="h-3 w-3" />
            </button>
            <a
              href={`${chain.explorer}/tx/${listing.paymentTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open transaction in explorer"
              className="rounded-sm p-0.5 text-ink-dim transition-colors hover:text-ink"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* What approving would publish. */}
      {(listing.blurb || listing.website || listing.logoUrl || listing.coverUrl) && (
        <div className="space-y-1 text-[11px] leading-relaxed text-ink-dim">
          {listing.blurb && <p className="text-ink-low">“{listing.blurb}”</p>}
          {listing.website && <p className="truncate">Site: {listing.website}</p>}
          {listing.twitter && <p className="truncate">X: {listing.twitter}</p>}
          {listing.telegram && <p className="truncate">Telegram: {listing.telegram}</p>}
        </div>
      )}

      {rejecting ? (
        <div className="space-y-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason, shown to the developer"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" onClick={reject}>
              Confirm decline
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={approve}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Payment confirmed — approve
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
            <XCircle className="h-3.5 w-3.5" />
            Decline
          </Button>
        </div>
      )}
    </li>
  );
}
