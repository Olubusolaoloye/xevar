import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact, formatPercent, formatQuantity, truncateAddress } from '@/lib/format';
import { CHAINS } from '@/data/chains';
import { useCurrency } from '@/hooks/useCurrency';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useLiveHoldings, useTrackedPositions } from '@/hooks/useLiveHoldings';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { PriceText } from '@/components/ui/PriceText';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

/** Modal for tracking a new wallet, with inline validation. */
function AddWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addWallet = usePortfolioStore((s) => s.addWallet);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = addWallet(address, label);
    if (!result.ok) {
      setError(result.error ?? 'Could not add that wallet.');
      return;
    }
    setAddress('');
    setLabel('');
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Track a wallet">
      <div className="space-y-3 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-mid">
            Wallet address
          </label>
          <Input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            placeholder="0x… or a Solana address"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-mid">
            Label <span className="text-ink-dim">(optional)</span>
          </label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            placeholder="Main wallet"
          />
        </div>

        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-ink-dim">
          PanScreener reads public balances only. It never asks for a seed
          phrase or a private key, and cannot move funds.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Track wallet
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Portfolio() {
  const wallets = usePortfolioStore((s) => s.wallets);
  // Balances come from storage; prices come from the live board. Positions
  // recorded on pair pages join them, carrying a real user-entered cost basis.
  const walletHoldings = useLiveHoldings();
  const tracked = useTrackedPositions();
  const holdings = useMemo(
    () => [...walletHoldings, ...tracked],
    [walletHoldings, tracked],
  );
  const history = usePortfolioStore((s) => s.history);
  const removeWallet = usePortfolioStore((s) => s.removeWallet);
  const { compact: money, convert, symbol } = useCurrency();

  const [addOpen, setAddOpen] = useState(false);

  const { totalValue, change24hPct, change24hUsd, byChain, sorted, totalCost } = useMemo(() => {
    const total = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

    // Back out yesterday's value from each position's own 24h move, rather
    // than averaging the percentages — a weighted figure is the honest one.
    const yesterday = holdings.reduce(
      (sum, h) => sum + h.valueUsd / (1 + h.change24h / 100),
      0,
    );

    const chainTotals = new Map<string, number>();
    for (const holding of holdings) {
      chainTotals.set(holding.chain, (chainTotals.get(holding.chain) ?? 0) + holding.valueUsd);
    }

    return {
      totalValue: total,
      change24hUsd: total - yesterday,
      change24hPct: yesterday > 0 ? ((total - yesterday) / yesterday) * 100 : 0,
      totalCost: holdings.reduce(
        (sum, h) => sum + (h.costBasis ?? h.priceUsd) * h.balance,
        0,
      ),
      byChain: [...chainTotals.entries()]
        .map(([chain, value]) => ({ chain, value }))
        .sort((a, b) => b.value - a.value),
      sorted: [...holdings].sort((a, b) => b.valueUsd - a.valueUsd),
    };
  }, [holdings]);

  /**
   * The stored history was generated against the seed total. Rescaling it by
   * the ratio to the live total keeps the shape of the curve while making its
   * final point agree with the headline figure — a chart that ends somewhere
   * other than the number printed above it reads as broken.
   */
  const valueSeries = useMemo(() => {
    const last = history[history.length - 1]?.valueUsd;
    if (!last || totalValue <= 0) return history;
    const ratio = totalValue / last;
    return history.map((point) => ({ ...point, valueUsd: point.valueUsd * ratio }));
  }, [history, totalValue]);

  const unrealised = totalValue - totalCost;
  const unrealisedPct = totalCost > 0 ? (unrealised / totalCost) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Holdings"
        title="Portfolio"
        description="Public balances across every wallet you track, valued live."
        action={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Track wallet
          </Button>
        }
      />

      {holdings.length === 0 ? (
        <Panel className="mt-5">
          <EmptyState
            icon={<WalletIcon className="h-5 w-5" />}
            title="No wallets tracked"
            description="Add a public address and PanScreener will value its holdings against the live board."
            action={
              <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                Track a wallet
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          {/* Headline figures */}
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
            <div className="bg-surface p-4">
              <Stat
                label="Total value"
                value={money(totalValue)}
                detail={
                  <span className="flex items-center gap-1">
                    <ChangeValue value={change24hPct} size="sm" />
                    <span className="text-ink-dim">
                      ({change24hUsd >= 0 ? '+' : '−'}
                      {money(Math.abs(change24hUsd))} 24h)
                    </span>
                  </span>
                }
              />
            </div>
            <div className="bg-surface p-4">
              <Stat label="Cost basis" value={money(totalCost)} detail="Across all positions" />
            </div>
            <div className="bg-surface p-4">
              <Stat
                label="Unrealised P&L"
                value={
                  <span className={unrealised >= 0 ? 'text-up' : 'text-down'}>
                    {unrealised >= 0 ? '+' : '−'}
                    {money(Math.abs(unrealised))}
                  </span>
                }
                detail={formatPercent(unrealisedPct)}
              />
            </div>
            <div className="bg-surface p-4">
              <Stat
                label="Positions"
                value={holdings.length}
                detail={`${wallets.length} wallet${wallets.length === 1 ? '' : 's'}`}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <Panel className="min-w-0 overflow-hidden">
              <PanelHeader title="Portfolio value" subtitle="Last 90 days" />
              <div className="h-[260px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueSeries} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                    <defs>
                      <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      tickFormatter={(time: number) =>
                        new Date(time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      tick={{ fill: 'var(--color-ink-dim)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={(value: number) => formatCompact(convert(value), symbol)}
                      tick={{ fill: 'var(--color-ink-dim)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={58}
                      orientation="right"
                    />
                    <Tooltip
                      cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }}
                      contentStyle={{
                        background: 'var(--color-overlay)',
                        border: '1px solid var(--color-line-strong)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(time) => new Date(time as number).toLocaleDateString()}
                      formatter={(value) => [money(value as number), 'Value']}
                    />
                    <Area
                      type="monotone"
                      dataKey="valueUsd"
                      stroke="var(--color-brand-500)"
                      strokeWidth={1.75}
                      fill="url(#portfolioFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader title="Allocation" subtitle="By network" />
              <div className="h-[150px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byChain}
                      dataKey="value"
                      nameKey="chain"
                      innerRadius={38}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {byChain.map((entry) => (
                        <Cell
                          key={entry.chain}
                          fill={CHAINS[entry.chain as keyof typeof CHAINS].colorVar}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="divide-y divide-line-soft border-t border-line">
                {byChain.map((entry) => (
                  <li
                    key={entry.chain}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <ChainChip chain={entry.chain as keyof typeof CHAINS} />
                    <span className="flex items-center gap-2">
                      <span className="tnum font-mono text-[11px] text-ink-mid">
                        {money(entry.value)}
                      </span>
                      <span className="tnum w-9 text-right font-mono text-[11px] text-ink-dim">
                        {((entry.value / totalValue) * 100).toFixed(0)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Positions */}
          <Panel className="mt-4 overflow-hidden">
            <PanelHeader title="Positions" subtitle={`${holdings.length} tokens`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-sunken/60">
                    {['Token', 'Balance', 'Price', '24h', 'Value', 'P&L'].map((label, i) => (
                      <th
                        key={label}
                        className={cn(
                          'px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-low',
                          i === 0 ? 'text-left' : 'text-right',
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((holding) => {
                    const cost = (holding.costBasis ?? holding.priceUsd) * holding.balance;
                    const pnl = holding.valueUsd - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

                    return (
                      <tr
                        key={holding.id}
                        className="border-b border-line-soft transition-colors hover:bg-raised/60"
                      >
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <TokenAvatar
                              symbol={holding.token.symbol}
                              chain={holding.chain}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink">
                                {holding.token.symbol}
                              </span>
                              <span className="block truncate text-[11px] text-ink-low">
                                {holding.token.name}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="tnum px-3 py-2.5 text-right font-mono text-xs text-ink-mid">
                          {formatQuantity(holding.balance)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <PriceText
                            usd={holding.priceUsd}
                            live
                            className="text-xs text-ink-mid"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <ChangeValue value={holding.change24h} size="sm" />
                        </td>
                        <td className="tnum px-3 py-2.5 text-right font-mono text-xs font-semibold text-ink">
                          {money(holding.valueUsd)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              'tnum block font-mono text-xs font-medium',
                              pnl >= 0 ? 'text-up' : 'text-down',
                            )}
                          >
                            {pnl >= 0 ? '+' : '−'}
                            {money(Math.abs(pnl))}
                          </span>
                          <span className="text-[11px] text-ink-dim">
                            {formatPercent(pnlPct)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Wallets */}
          <Panel className="mt-4 overflow-hidden">
            <PanelHeader title="Tracked wallets" subtitle={`${wallets.length} connected`} />
            <ul className="divide-y divide-line-soft">
              {wallets.map((wallet) => {
                const value = holdings
                  .filter((h) => h.walletId === wallet.id)
                  .reduce((sum, h) => sum + h.valueUsd, 0);

                return (
                  <li
                    key={wallet.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-ink-low">
                        <WalletIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {wallet.label}
                        </p>
                        <p className="truncate font-mono text-[11px] text-ink-low">
                          {truncateAddress(wallet.address, 10, 6)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden items-center gap-1 sm:flex">
                        {wallet.chains.slice(0, 3).map((chain) => (
                          <ChainChip key={chain} chain={chain} compact />
                        ))}
                        {wallet.chains.length > 3 && (
                          <Badge>+{wallet.chains.length - 3}</Badge>
                        )}
                      </div>
                      <span className="tnum font-mono text-sm font-semibold text-ink">
                        {money(value)}
                      </span>
                      <button
                        onClick={() => removeWallet(wallet.id)}
                        aria-label={`Stop tracking ${wallet.label}`}
                        className="rounded-sm p-1.5 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      )}

      <AddWalletModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
