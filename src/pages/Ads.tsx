import { Megaphone, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Advertising — not open yet.
 *
 * The carousel on the overview already renders paid slides, but there is no
 * self-serve way to buy one, so this says so rather than presenting a form
 * that goes nowhere.
 */
const PLANNED = [
  {
    title: 'Carousel placement',
    body: 'A slide in the rotation at the top of the overview, on every device.',
  },
  {
    title: 'Board promotion',
    body: 'A pinned position on the screener, marked as promoted — never disguised as a ranking.',
  },
  {
    title: 'Token page banner',
    body: 'A banner on a specific token page, sold by the week.',
  },
];

export function Ads() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Coming soon"
        title="Advertise"
        description="Placements across the board, sold directly."
      />

      <Panel elevation="lifted" className="mt-5 overflow-hidden">
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:py-14">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-500">
            <Megaphone className="h-5 w-5" />
          </span>

          <div className="max-w-md space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">
                Not open yet
              </h2>
              <Badge tone="warn">Soon</Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink-low">
              Ad placements are run by the operator for now. Self-serve booking
              is being built — until it exists there is nothing to buy here, so
              there is no form pretending otherwise.
            </p>
          </div>
        </div>

        <div className="border-t border-line bg-sunken/50 px-5 py-5">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
            <Sparkles className="h-3 w-3" />
            Planned placements
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {PLANNED.map((item) => (
              <li key={item.title}>
                <p className="text-xs font-medium text-ink-mid">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <p className="mt-5 px-1 text-[11px] leading-relaxed text-ink-dim">
        Anything paid for will be labelled as paid. A screener that sells
        rankings without saying so is not a screener.
      </p>
    </div>
  );
}
