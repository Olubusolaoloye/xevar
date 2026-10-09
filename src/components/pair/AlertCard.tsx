import { useMemo, useState } from 'react';
import { BellPlus, Check } from 'lucide-react';
import { formatPercent } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ALERT_METRIC_LABEL as METRIC_LABEL,
  alertActions,
  metricFormat,
  readMetric,
  useAlertStore,
} from '@/store/useAlertStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';
import type { AlertComparator, AlertMetric, Pair } from '@/data/types';

/**
 * Set an alert on the token you are looking at.
 *
 * The alerts page could already do every one of these — market cap included —
 * but only from its own screen, behind a token search. Which meant that the
 * moment somebody actually wants an alert, reading a market cap on this page,
 * the thing to do was leave, search for the token they were just looking at,
 * and start again. The metric was never missing; the place to say so was.
 *
 * Prefilled with this pair for that reason, and seeded with the figure now on
 * screen so a threshold is a nudge away rather than a number to go and find.
 */
export function AlertCard({ pair }: { pair: Pair }) {
  const { compact: money, priceText } = useCurrency();
  const alerts = useAlertStore((s) => s.alerts);

  const [metric, setMetric] = useState<AlertMetric>('marketCap');
  const [comparator, setComparator] = useState<AlertComparator>('above');
  const [threshold, setThreshold] = useState('');
  const [saved, setSaved] = useState(false);

  const current = readMetric(pair, metric);
  const shape = metricFormat(metric);

  const mine = useMemo(
    () => alerts.filter((alert) => alert.pairId === pair.id),
    [alerts, pair.id],
  );

  /** The live figure, written the way this metric is read. */
  const currentText =
    shape === 'percent'
      ? formatPercent(current)
      : shape === 'price'
        ? priceText(current)
        : money(current);

  const value = Number.parseFloat(threshold);
  const valid = Number.isFinite(value);

  const submit = () => {
    if (!valid) return;
    void alertActions.add({
      pairId: pair.id,
      pairLabel: `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`,
      chain: pair.chain,
      metric,
      comparator,
      threshold: value,
      enabled: true,
    });
    setThreshold('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PanelHeader
        title="Alert me"
        subtitle={
          mine.length > 0
            ? `${mine.length} alert${mine.length === 1 ? '' : 's'} on this pair`
            : `When ${pair.baseToken.symbol} crosses a level`
        }
        icon={<BellPlus className="h-4 w-4" />}
      />

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor={`alert-metric-${pair.id}`}
              className="mb-1 block text-[11px] font-medium text-ink-mid"
            >
              Watch
            </label>
            <select
              id={`alert-metric-${pair.id}`}
              value={metric}
              onChange={(event) => {
                setMetric(event.target.value as AlertMetric);
                // The number means something different now — a cap threshold
                // read as a price would fire instantly and look like a bug.
                setThreshold('');
              }}
              className="h-9 w-full rounded-md border border-line bg-sunken px-2 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
            >
              {(Object.keys(METRIC_LABEL) as AlertMetric[]).map((key) => (
                <option key={key} value={key}>
                  {METRIC_LABEL[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`alert-cmp-${pair.id}`}
              className="mb-1 block text-[11px] font-medium text-ink-mid"
            >
              Condition
            </label>
            <select
              id={`alert-cmp-${pair.id}`}
              value={comparator}
              onChange={(event) => setComparator(event.target.value as AlertComparator)}
              className="h-9 w-full rounded-md border border-line bg-sunken px-2 text-sm text-ink focus:border-brand-500/50 focus:outline-none"
            >
              <option value="above">Goes above</option>
              <option value="below">Goes below</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor={`alert-threshold-${pair.id}`}
            className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink-mid"
          >
            <span>Threshold</span>
            <span className="text-ink-dim">now {currentText}</span>
          </label>
          <Input
            id={`alert-threshold-${pair.id}`}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            inputMode="decimal"
            placeholder={shape === 'percent' ? '10' : metric === 'marketCap' ? '1000000' : '0'}
            suffix={<span className="text-xs">{shape === 'percent' ? '%' : 'USD'}</span>}
          />
        </div>

        <Button
          size="sm"
          variant={saved ? 'primary' : 'secondary'}
          className="w-full"
          disabled={!valid}
          onClick={submit}
        >
          {saved ? (
            <>
              <Check className="h-3 w-3" />
              Alert set
            </>
          ) : (
            'Set alert'
          )}
        </Button>

        <p className="text-[10px] leading-relaxed text-ink-dim">
          Fires once when the level is crossed, not every time it is checked.
          Signed in, it is watched on the server and reaches you with
          PanScreener closed.
        </p>
      </div>
    </div>
  );
}
