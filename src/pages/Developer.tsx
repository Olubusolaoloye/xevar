import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { CHAIN_LIST } from '@/data/chains';
import {
  LISTING_FEE_USD,
  LISTING_PAYMENT_ADDRESS,
  LISTING_STATUS_LABEL,
  type ListingStatus,
} from '@/data/listingStatus';
import { hasBackend } from '@/lib/supabase';
import { formatAge } from '@/lib/format';
import { MIN_PASSWORD_LENGTH, useAuthStore } from '@/store/useAuthStore';
import { CATEGORY_LABEL, type TokenCategory } from '@/store/useListingStore';
import {
  useDeveloperStore,
  type DeveloperSubmission,
  type SubmissionDraft,
} from '@/store/useDeveloperStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ChainId } from '@/data/types';

const STATUS_TONE: Record<ListingStatus, 'neutral' | 'warn' | 'up' | 'down'> = {
  tracking: 'neutral',
  pending: 'warn',
  approved: 'up',
  rejected: 'down',
};

const STATUS_ICON: Record<ListingStatus, typeof Clock> = {
  tracking: Clock,
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

/* -------------------------------------------------------------------------- */
/* Sign in / sign up                                                          */
/* -------------------------------------------------------------------------- */

function DeveloperAuth() {
  const { signUp, signInWithPassword } = useAuthStore();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const ready = email.trim().length > 3 && password.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result =
      mode === 'up'
        ? await signUp(email, password)
        : await signInWithPassword(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    if (mode === 'up' && 'needsConfirmation' in result && result.needsConfirmation) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Panel elevation="lifted" className="mx-auto mt-6 max-w-md overflow-hidden">
        <div className="space-y-2 p-6 text-center">
          <p className="font-display text-sm font-semibold text-ink">Check your inbox</p>
          <p className="text-xs leading-relaxed text-ink-low">
            If that address can be registered, a confirmation link is on its way.
            Open it and you will land back here, signed in.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel elevation="lifted" className="mx-auto mt-6 max-w-md overflow-hidden">
      <div className="flex border-b border-line">
        {(['in', 'up'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={
              'flex-1 px-4 py-3 text-xs font-medium transition-colors ' +
              (mode === value
                ? 'border-b-2 border-brand-500 text-ink'
                : 'text-ink-low hover:text-ink-mid')
            }
          >
            {value === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-5">
        <div>
          <label htmlFor="dev-email" className="mb-1.5 block text-xs font-medium text-ink-mid">
            Email
          </label>
          <Input
            id="dev-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@project.xyz"
          />
        </div>

        <div>
          <label htmlFor="dev-password" className="mb-1.5 block text-xs font-medium text-ink-mid">
            Password
          </label>
          <Input
            id="dev-password"
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && ready && void submit()}
          />
          {mode === 'up' && (
            <p className="mt-1 text-[11px] text-ink-dim">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!ready}
          onClick={() => void submit()}
        >
          {busy ? 'Working…' : mode === 'up' ? 'Create developer account' : 'Sign in'}
        </Button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment instructions                                                       */
/* -------------------------------------------------------------------------- */

function PaymentPanel() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LISTING_PAYMENT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable in some contexts; the address is on screen.
    }
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title={`Listing fee — $${LISTING_FEE_USD}`}
        subtitle="Paid once, per token"
        icon={<ShieldCheck className="h-4 w-4" />}
      />
      <div className="space-y-3 p-4">
        <div>
          <p className="mb-1.5 text-[11px] text-ink-low">Send to</p>
          <div className="flex items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2.5">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-ink-mid">
              {LISTING_PAYMENT_ADDRESS}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy payment address"
              className="shrink-0 rounded-sm p-1 text-ink-dim transition-colors hover:text-ink"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {copied && <p className="mt-1 text-[11px] text-up">Copied.</p>}
        </div>

        <ol className="space-y-1.5 text-[11px] leading-relaxed text-ink-low">
          <li>1. Add your token below — it starts being tracked straight away.</li>
          <li>2. Fill in the details you want shown: logo, banner, description, links.</li>
          <li>3. Send ${LISTING_FEE_USD} to the address above.</li>
          <li>4. Paste the transaction hash and submit for review.</li>
          <li>5. An admin confirms the payment and approves the listing.</li>
        </ol>

        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
          Check the address character by character before sending. Nobody at
          PanScreener can reverse a transfer to the wrong address, and no one
          here will ever message you asking for a different one.
        </p>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Submission form                                                            */
/* -------------------------------------------------------------------------- */

const EMPTY_DRAFT: SubmissionDraft = {
  chain: 'bsc',
  address: '',
  symbol: '',
  label: '',
  category: 'meme',
  logoUrl: '',
  coverUrl: '',
  blurb: '',
  website: '',
  twitter: '',
  telegram: '',
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-mid">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-dim">{hint}</p>}
    </div>
  );
}

function SubmitForm({ ownerId, onDone }: { ownerId: string; onDone: () => void }) {
  const create = useDeveloperStore((s) => s.create);
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SubmissionDraft>(key: K, value: SubmissionDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    const result = await create(ownerId, draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save.');
      return;
    }
    setDraft(EMPTY_DRAFT);
    onDone();
  };

  const ready = draft.address.trim().length > 0 && draft.symbol.trim().length > 0 && !busy;

  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Network">
          <select
            value={draft.chain}
            onChange={(e) => set('chain', e.target.value as ChainId)}
            className="h-9 w-full rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
          >
            {CHAIN_LIST.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category">
          <select
            value={draft.category}
            onChange={(e) => set('category', e.target.value as TokenCategory)}
            className="h-9 w-full rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
          >
            {(Object.keys(CATEGORY_LABEL) as TokenCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Contract address"
        hint="This alone is enough to start tracking price, liquidity and flow."
      >
        <Input
          value={draft.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="0x…"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ticker">
          <Input
            value={draft.symbol}
            onChange={(e) => set('symbol', e.target.value)}
            placeholder="WKC"
          />
        </Field>
        <Field label="Display name">
          <Input
            value={draft.label ?? ''}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Wiki Cat"
          />
        </Field>
      </div>

      <div className="rounded-md border border-line bg-sunken/50 p-3">
        <p className="mb-2.5 text-[11px] leading-relaxed text-ink-dim">
          Everything below is shown only after the payment is confirmed and the
          listing is approved. Until then the token is tracked, but the page
          shows market data alone.
        </p>

        <div className="space-y-3">
          <Field label="Description">
            <textarea
              value={draft.blurb ?? ''}
              onChange={(e) => set('blurb', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-line bg-sunken px-2.5 py-2 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
              placeholder="What the project is, in a sentence or two."
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logo URL">
              <Input value={draft.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} />
            </Field>
            <Field label="Banner URL">
              <Input value={draft.coverUrl ?? ''} onChange={(e) => set('coverUrl', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Website">
              <Input value={draft.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            </Field>
            <Field label="X / Twitter">
              <Input value={draft.twitter ?? ''} onChange={(e) => set('twitter', e.target.value)} />
            </Field>
            <Field label="Telegram">
              <Input value={draft.telegram ?? ''} onChange={(e) => set('telegram', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
          {error}
        </p>
      )}

      <Button variant="primary" disabled={!ready} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Add token'}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One submission                                                             */
/* -------------------------------------------------------------------------- */

function SubmissionRow({ submission }: { submission: DeveloperSubmission }) {
  const { submitForReview, withdraw } = useDeveloperStore();
  const [hash, setHash] = useState(submission.paymentTxHash ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = STATUS_ICON[submission.status];
  const canSubmit = submission.status === 'tracking' || submission.status === 'rejected';

  const send = async () => {
    setBusy(true);
    setError(null);
    const result = await submitForReview(submission.id, hash);
    setBusy(false);
    if (!result.ok) setError(result.error ?? 'Could not submit.');
  };

  return (
    <li className="space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{submission.symbol}</span>
          <Badge tone={STATUS_TONE[submission.status]}>
            <Icon className="h-3 w-3" />
            {LISTING_STATUS_LABEL[submission.status]}
          </Badge>
          {submission.verified && <Badge tone="up">Verified</Badge>}
        </span>

        {submission.status !== 'approved' && (
          <button
            type="button"
            onClick={() => void withdraw(submission.id)}
            aria-label={`Withdraw ${submission.symbol}`}
            className="rounded-sm p-1.5 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {submission.status === 'rejected' && submission.reviewNote && (
        <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-[11px] leading-relaxed text-down">
          {submission.reviewNote}
        </p>
      )}

      {submission.status === 'pending' && (
        <p className="text-[11px] leading-relaxed text-ink-dim">
          Submitted {submission.submittedAt ? `${formatAge(submission.submittedAt)} ago` : ''} — an
          admin is checking the transaction. The token is tracked meanwhile.
        </p>
      )}

      {submission.status === 'approved' && (
        <p className="text-[11px] leading-relaxed text-ink-dim">
          Live. To change the details, contact the operator — a listing cannot be
          edited after review, which is what makes the review mean anything.
        </p>
      )}

      {canSubmit && (
        <div className="space-y-2">
          <Input
            value={hash}
            onChange={(e) => {
              setHash(e.target.value);
              setError(null);
            }}
            placeholder="0x… payment transaction hash"
          />
          {error && <p className="text-[11px] text-down">{error}</p>}
          <Button size="sm" variant="primary" disabled={busy || !hash.trim()} onClick={() => void send()}>
            {busy ? 'Submitting…' : 'Submit for review'}
          </Button>
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Developer() {
  const { email, userId, ready, init, signOut } = useAuthStore();
  const { submissions, loading, load } = useDeveloperStore();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  if (!hasBackend) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader eyebrow="Listings" title="Developers" />
        <EmptyState
          title="Not available without a backend"
          description="Submissions are stored server-side. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable the developer portal."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Listings"
        title="Developers"
        description="Get your token tracked for free, and listed in full once the fee is confirmed."
        action={
          email ? (
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              <LogOut className="h-3 w-3" />
              Sign out
            </Button>
          ) : undefined
        }
      />

      {!ready ? (
        <p className="mt-6 text-center text-sm text-ink-low">Checking your session…</p>
      ) : !email || !userId ? (
        /* Signed out: the sign-in form and nothing else.

           The payment address and the listing terms used to sit above it, on
           the reasoning that someone deciding whether to bother should be able
           to read the price first. But a payment address on a page anyone can
           load is a payment address that can be screenshotted out of context,
           and the fee only means anything attached to a submission that an
           account owns. Sign in, then see what to send and where. */
        <DeveloperAuth />
      ) : (
        <div className="mt-5 space-y-4">
          <PaymentPanel />

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Your tokens"
              subtitle={email}
              action={
                <Button size="sm" variant={adding ? 'ghost' : 'primary'} onClick={() => setAdding((v) => !v)}>
                  <Plus className="h-3.5 w-3.5" />
                  {adding ? 'Cancel' : 'Add token'}
                </Button>
              }
            />

            {adding && <SubmitForm ownerId={userId} onDone={() => setAdding(false)} />}

            {loading ? (
              <p className="px-4 py-6 text-center text-xs text-ink-low">Loading…</p>
            ) : submissions.length === 0 ? (
              !adding && (
                <EmptyState
                  title="No tokens yet"
                  description="Add a contract address and it starts being tracked immediately."
                />
              )
            ) : (
              <ul className="divide-y divide-line-soft">
                {submissions.map((submission) => (
                  <SubmissionRow key={submission.id} submission={submission} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
