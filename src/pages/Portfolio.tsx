import { Wallet, LineChart, Bell, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Portfolio — not built yet.
 *
 * This screen previously rendered a portfolio assembled from invented wallets,
 * balances and a random-walk value history. On a market app that is worse than
 * showing nothing: a number formatted like a balance reads as a balance, and
 * nothing on the page told you otherwise.
 *
 * So it says what it is. What it points at instead — the watchlist, alerts and
 * per-token P&L — is all real and all working today.
 */

const PLANNED = [
  {
    title: 'Read-only wallet balances',
    body: 'Paste an address and see what it holds, priced against the same live pools as the rest of the board. Read-only — no signing, ever.',
  },
  {
    title: 'Cost basis and realised P&L',
    body: 'Positions reconstructed from on-chain history rather than typed in by hand, so the numbers survive you forgetting to record a trade.',
  },
  {
    title: 'Value over time',
    body: 'A real series recorded as it happens. Not backfilled, because a chart of a past nobody observed is decoration.',
  },
];

const AVAILABLE = [
  {
    to: '/watchlist',
    icon: Star,
    title: 'Watchlist',
    body: 'Follow any listed pair and keep it one tap away.',
  },
  {
    to: '/alerts',
    icon: Bell,
    title: 'Alerts',
    body: 'Fire on price, liquidity, volume or 24h change — checked against the live board.',
  },
  {
    to: '/multichart',
    icon: LineChart,
    title: 'Multi-chart',
    body: 'Put two tokens side by side on the same screen.',
  },
];

export function Portfolio() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Coming soon"
        title="Portfolio"
        description="Wallet holdings, cost basis and performance over time."
      />

      <Panel elevation="lifted" className="mt-5 overflow-hidden">
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:py-14">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-500">
            <Wallet className="h-5 w-5" />
          </span>

          <div className="max-w-md space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                Not ready yet
              </h2>
              <Badge tone="warn">Soon</Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink-low">
              Portfolio is being built against real wallet data. Until it reads
              actual balances it stays closed — a portfolio screen showing
              numbers nobody owns is worse than no screen at all.
            </p>
          </div>
        </div>

        <div className="border-t border-line bg-sunken/50 px-5 py-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
            What it will do
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {PLANNED.map((item) => (
              <li key={item.title}>
                <p className="text-xs font-medium text-ink-mid">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <p className="mb-3 mt-6 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
        Working today
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {AVAILABLE.map(({ to, icon: Icon, title, body }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-brand-500/40"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-brand-500" />
                <span className="text-sm font-medium text-ink">{title}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-dim transition-transform group-hover:translate-x-0.5 group-hover:text-ink-low" />
              </span>
              <span className="text-[11px] leading-relaxed text-ink-dim">{body}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-5 px-1 text-[11px] leading-relaxed text-ink-dim">
        Per-token profit and loss already works: open any token and record a
        position on its page to track it against the live price.
      </p>
    </div>
  );
}
