import { Palette, SlidersHorizontal, Wallet } from 'lucide-react';
import { CURRENCY_SYMBOL, usePrefsStore, type Currency } from '@/store/usePrefsStore';
import { useScreenerStore } from '@/store/useScreenerStore';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/brand/Logo';
import { PageHeader } from '@/components/layout/PageHeader';

const CURRENCY_OPTIONS = (Object.keys(CURRENCY_SYMBOL) as Currency[]).map((code) => ({
  value: code,
  label: `${CURRENCY_SYMBOL[code]} ${code}`,
}));

const DENSITY_OPTIONS = [
  { value: 'comfortable' as const, label: 'Comfortable' },
  { value: 'compact' as const, label: 'Compact' },
];

function Row({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-low">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function Settings() {
  const currency = usePrefsStore((s) => s.currency);
  const setCurrency = usePrefsStore((s) => s.setCurrency);
  const reduceFlash = usePrefsStore((s) => s.reduceFlash);
  const setReduceFlash = usePrefsStore((s) => s.setReduceFlash);

  const density = useScreenerStore((s) => s.density);
  const setDensity = useScreenerStore((s) => s.setDensity);
  const watchlist = useScreenerStore((s) => s.watchlist);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Display and behaviour options. Everything here is stored in this browser only."
      />

      <div className="mt-5 space-y-4">
        <Panel className="overflow-hidden">
          <PanelHeader title="Display" icon={<Palette className="h-4 w-4" />} />
          <div className="divide-y divide-line-soft">
            <Row
              label="Quote currency"
              description="All market values are stored in USD and converted for display only."
              control={
                <SegmentedControl<Currency>
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={setCurrency}
                  size="sm"
                />
              }
            />
            <Row
              label="Table density"
              description="Compact fits roughly a third more rows on screen."
              control={
                <SegmentedControl
                  options={DENSITY_OPTIONS}
                  value={density}
                  onChange={setDensity}
                  size="sm"
                />
              }
            />
            <div className="px-4 py-3.5">
              <Toggle
                checked={reduceFlash}
                onChange={setReduceFlash}
                label="Reduce price flashing"
                description="Turn off the green and red wash that plays when a price ticks. Your system's reduce-motion setting is always respected regardless of this."
              />
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Data" icon={<SlidersHorizontal className="h-4 w-4" />} />
          <div className="divide-y divide-line-soft">
            <Row
              label="Live price feed"
              description="Majors stream from a public exchange websocket. Long-tail DEX pairs are generated from a fixed seed, so the board is identical on every reload."
              control={
                <span className="rounded-xs border border-brand-500/25 bg-brand-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-500">
                  Connected
                </span>
              }
            />
            <Row
              label="Stored locally"
              description={`${watchlist.length} watched pair${watchlist.length === 1 ? '' : 's'}, plus your wallets, alerts and preferences.`}
              control={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('panscreener.screener');
                    localStorage.removeItem('panscreener.portfolio');
                    localStorage.removeItem('panscreener.prefs');
                    window.location.reload();
                  }}
                >
                  Reset all data
                </Button>
              }
            />
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Security" icon={<Wallet className="h-4 w-4" />} />
          <div className="px-4 py-3.5">
            <p className="text-xs leading-relaxed text-ink-mid">
              PanScreener is read-only. It tracks public addresses, never
              requests a seed phrase or private key, and has no ability to sign
              a transaction or move funds. Risk signals on pair pages are
              automated heuristics, not audits — always verify a contract
              yourself.
            </p>
          </div>
        </Panel>

        <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3.5">
          <Wordmark size="sm" />
          <span className="font-mono text-[11px] text-ink-dim">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
