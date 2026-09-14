import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type { SecuritySignals } from '@/data/types';

interface CheckRow {
  label: string;
  pass: boolean;
  detail: string;
  help: string;
}

function buildRows(security: SecuritySignals): CheckRow[] {
  return [
    {
      label: 'Liquidity locked',
      pass: security.liquidityLocked,
      detail: `${security.liquidityLockedPct.toFixed(0)}% locked or burned`,
      help: 'Locked liquidity cannot be withdrawn by the deployer, which is the mechanism behind most rug pulls.',
    },
    {
      label: 'Mint renounced',
      pass: security.mintRenounced,
      detail: security.mintRenounced ? 'Supply is fixed' : 'Owner can mint more supply',
      help: 'If minting is still enabled, the owner can dilute every holder at will.',
    },
    {
      label: 'Ownership renounced',
      pass: security.ownershipRenounced,
      detail: security.ownershipRenounced ? 'No privileged owner' : 'Owner retains control',
      help: 'A retained owner can often change fees, pause trading, or blacklist addresses.',
    },
    {
      label: 'Contract verified',
      pass: security.verifiedContract,
      detail: security.verifiedContract ? 'Source published' : 'Source not published',
      help: 'Unverified source cannot be reviewed, so its behaviour is unknown.',
    },
    {
      label: 'Holder concentration',
      // Above 50% in ten wallets, a single holder can move the market alone.
      pass: security.topHolderPct < 50,
      detail: `Top 10 hold ${security.topHolderPct.toFixed(0)}%`,
      help: 'Highly concentrated supply means a handful of wallets can exit into your liquidity.',
    },
    {
      label: 'Transfer tax',
      pass: security.buyTaxPct + security.sellTaxPct < 10,
      detail: `${security.buyTaxPct.toFixed(1)}% buy · ${security.sellTaxPct.toFixed(1)}% sell`,
      help: 'A high or asymmetric sell tax can make a position difficult to exit profitably.',
    },
  ];
}

/**
 * Automated contract signals.
 *
 * Framed as individual checks with their reasoning attached, never as a single
 * "safe / unsafe" score. A green score on a scam token is actively dangerous —
 * it launders a heuristic into a guarantee. The caveat at the foot is not
 * boilerplate; it is the honest description of what this panel can know.
 */
export function SecurityPanel({ security }: { security: SecuritySignals }) {
  // No contract-safety data from the live provider. Six red crosses would read
  // as "this token failed every check" — the opposite of the truth, which is
  // that nothing is known either way.
  if (!security.available) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-ink-low" />
            Risk signals
          </p>
          <span className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-low">
            n/a
          </span>
        </div>
        <p className="flex items-start gap-2 px-4 py-4 text-[11px] leading-relaxed text-ink-low">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
          Contract checks aren't available from the live market feed. Verify
          liquidity locks, mint authority and holder concentration on a block
          explorer or a dedicated contract scanner before trading.
        </p>
      </div>
    );
  }

  const rows = buildRows(security);
  const passed = rows.filter((row) => row.pass).length;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-ink-low" />
          Risk signals
        </p>
        <span
          className={cn(
            'tnum rounded-xs px-1.5 py-0.5 font-mono text-[11px] font-semibold',
            passed >= 5 && 'bg-up/12 text-up',
            passed >= 3 && passed < 5 && 'bg-warn/12 text-warn',
            passed < 3 && 'bg-down/12 text-down',
          )}
        >
          {passed}/{rows.length}
        </span>
      </div>

      <ul className="divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                row.pass ? 'bg-up/12 text-up' : 'bg-down/12 text-down',
              )}
            >
              {row.pass ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <X className="h-3 w-3" strokeWidth={3} />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <Tooltip content={row.help}>
                <span className="cursor-help border-b border-dotted border-ink-dim/40 text-xs font-medium text-ink">
                  {row.label}
                </span>
              </Tooltip>
              <span className="block truncate text-[11px] text-ink-low">{row.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-dim">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
        These are automated heuristics, not an audit. They cannot detect every
        exploit, and passing every check is not a guarantee of safety.
      </p>
    </div>
  );
}
