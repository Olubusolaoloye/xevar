import { useMemo, useState } from 'react';
import { Bell, BellRing, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatCompact } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Toggle } from '@/components/ui/Toggle';
import { ChainChip } from '@/components/ui/ChainChip';
import { PageHeader } from '@/components/layout/PageHeader';
import type { Alert, AlertComparator, AlertMetric, Pair } from '@/data/types';

const METRIC_LABEL: Record<AlertMetric, string> = {
  price: 'Price',
  change24h: '24h change',
  liquidity: 'Liquidity',
  volume24h: '24h volume',
};

/** Read the value an alert watches off a pair. */
function readMetric(pair: Pair, metric: AlertMetric): number {
  switch (metric) {
    case 'price':
      return pair.priceUsd;
    case 'change24h':
      return pair.change.h24;
    case 'liquidity':
      return pair.liquidityUsd;
    case 'volume24h':
      return pair.volume.h24;
  }
}

function describe(alert: Alert, format: (usd: number) => string): string {
  const threshold =
    alert.metric === 'change24h'
      ? `${alert.threshold}%`
      : format(alert.threshold);
  return `${METRIC_LABEL[alert.metric]} goes ${alert.comparator} ${threshold}`;
}

function CreateAlertModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pairs = useMarketStore((s) => s.pairs);
  const addAlert = usePortfolioStore((s) => s.addAlert);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Pair | null>(null);
  const [metric, setMetric] = useState<AlertMetric>('price');
  const [comparator, setComparator] = useState<AlertComparator>('above');
  const [threshold, setThreshold] = useState('');

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return pairs
      .filter(
        (pair) =>
          pair.baseToken.symbol.toLowerCase().includes(q) ||
          pair.baseToken.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [search, pairs]);

  const value = Number.parseFloat(threshold);
  const valid = selected !== null && Number.isFinite(value);

  const submit = () => {
    if (!valid || !selected) return;
    addAlert({
      pairId: selected.id,
      pairLabel: `${selected.baseToken.symbol} / ${selected.quoteToken.symbol}`,
      chain: selected.chain,
      metric,
      comparator,
      threshold: value,
      enabled: true,
    });
    setSearch('');
    setSelected(null);
    setThreshold('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New alert">
      <div className="space-y-3 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-mid">Pair</label>
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-sunken px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">
                  {selected.baseToken.symbol}/{selected.quoteToken.symbol}
                </span>
                <ChainChip chain={selected.chain} compact />
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-ink-low transition-colors hover:text-ink"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search for a token…"
                autoFocus
              />
              {matches.length > 0 && (
                <ul className="mt-1.5 overflow-hidden rounded-md border border-line">
                  {matches.map((pair) => (
                    <li key={pair.id}>
                      <button
                        onClick={() => setSelected(pair)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-raised"
                      >
                        <span className="text-sm text-ink">
                          {pair.baseToken.symbol}/{pair.quoteToken.symbol}
                        </span>
                        <ChainChip chain={pair.chain} compact />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-mid">Metric</label>
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as AlertMetric)}
              className="h-9 w-full rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
            >
              {(Object.keys(METRIC_LABEL) as AlertMetric[]).map((key) => (
                <option key={key} value={key}>
                  {METRIC_LABEL[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-mid">
              Condition
            </label>
            <select
              value={comparator}
              onChange={(event) => setComparator(event.target.value as AlertComparator)}
              className="h-9 w-full rounded-md border border-line bg-sunken px-2.5 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
            >
              <option value="above">Goes above</option>
              <option value="below">Goes below</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-mid">
            Threshold
          </label>
          <Input
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            inputMode="decimal"
            placeholder={metric === 'change24h' ? '10' : '3000'}
            suffix={
              <span className="text-xs">{metric === 'change24h' ? '%' : 'USD'}</span>
            }
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Create alert
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Alerts() {
  const alerts = usePortfolioStore((s) => s.alerts);
  const toggleAlert = usePortfolioStore((s) => s.toggleAlert);
  const removeAlert = usePortfolioStore((s) => s.removeAlert);
  const pairs = useMarketStore((s) => s.pairs);
  const { compact: money, priceText } = useCurrency();

  const [createOpen, setCreateOpen] = useState(false);

  const active = alerts.filter((alert) => alert.enabled).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Monitoring"
        title="Alerts"
        description="Trigger conditions on price, liquidity and flow across any tracked pair."
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New alert
          </Button>
        }
      />

      <Panel className="mt-5 overflow-hidden">
        <PanelHeader
          title="Your alerts"
          subtitle={`${active} active of ${alerts.length}`}
          icon={<Bell className="h-4 w-4" />}
        />

        {alerts.length === 0 ? (
          <EmptyState
            icon={<BellRing className="h-5 w-5" />}
            title="No alerts yet"
            description="Create a trigger and PanScreener will watch the condition against the live board."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                Create your first alert
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {alerts.map((alert) => {
              const pair = pairs.find((p) => p.id === alert.pairId);
              const current = pair ? readMetric(pair, alert.metric) : null;

              // An alert whose condition is already true right now is worth
              // surfacing — it is about to fire, or just has.
              const met =
                current !== null &&
                (alert.comparator === 'above'
                  ? current > alert.threshold
                  : current < alert.threshold);

              return (
                <li
                  key={alert.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3',
                    !alert.enabled && 'opacity-55',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                        met && alert.enabled
                          ? 'border-warn/30 bg-warn/10 text-warn'
                          : 'border-line bg-sunken text-ink-low',
                      )}
                    >
                      <Bell className="h-4 w-4" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-ink">
                          {alert.pairLabel}
                        </p>
                        <ChainChip chain={alert.chain} compact />
                        {met && alert.enabled && <Badge tone="warn">Condition met</Badge>}
                        {alert.triggeredAt && (
                          <Badge>Fired {formatAge(alert.triggeredAt)} ago</Badge>
                        )}
                      </div>

                      <p className="truncate text-[11px] text-ink-low">
                        {describe(alert, alert.metric === 'price' ? priceText : money)}
                        {current !== null && (
                          <span className="text-ink-dim">
                            {' · now '}
                            {alert.metric === 'change24h'
                              ? `${current.toFixed(1)}%`
                              : alert.metric === 'price'
                                ? priceText(current)
                                : formatCompact(current, '$')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <Toggle
                      checked={alert.enabled}
                      onChange={() => toggleAlert(alert.id)}
                    />
                    <button
                      onClick={() => removeAlert(alert.id)}
                      aria-label="Delete alert"
                      className="rounded-sm p-1.5 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-dim">
        Alerts evaluate against the in-app board while PanScreener is open. Push
        and email delivery are not wired up in this build.
      </p>

      <CreateAlertModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
