import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Globe,
  Send,
  Star,
  Twitter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatAge,
  formatCompact,
  formatCount,
  truncateAddress,
} from '@/lib/format';
import { CHAINS } from '@/data/chains';
import { TIMEFRAMES, TIMEFRAME_LABEL } from '@/data/types';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import { useScreenerStore } from '@/store/useScreenerStore';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { Badge } from '@/components/ui/Badge';
import { PriceChart } from '@/components/pair/PriceChart';
import { TradeTape } from '@/components/pair/TradeTape';
import { SecurityPanel } from '@/components/pair/SecurityPanel';
import { PnlCard } from '@/components/pair/PnlCard';
import { ProfitCalculator } from '@/components/pair/ProfitCalculator';
import type { Pair } from '@/data/types';

/** A copyable on-chain address with an explorer link. */
function AddressRow({ label, address, explorer }: { label: string; address: string; explorer: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[11px] text-ink-low">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-ink-mid">
          {truncateAddress(address, 6, 4)}
        </span>
        <button
          onClick={() => navigator.clipboard?.writeText(address)}
          aria-label={`Copy ${label}`}
          className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-ink"
        >
          <Copy className="h-3 w-3" />
        </button>
        <a
          href={`${explorer}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${label} on explorer`}
          className="rounded-xs p-0.5 text-ink-dim transition-colors hover:text-brand-500"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    </div>
  );
}

/** The four rolling windows, shown as a single comparative block. */
function ChangeGrid({ pair }: { pair: Pair }) {
  return (
    <div className="grid grid-cols-4 gap-px bg-line">
      {TIMEFRAMES.map((tf) => (
        <div key={tf} className="bg-surface px-2 py-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
            {TIMEFRAME_LABEL[tf]}
          </p>
          <ChangeValue value={pair.change[tf]} size="sm" className="mt-1 font-semibold" />
        </div>
      ))}
    </div>
  );
}

/** Buy/sell flow for each window, as counts plus a pressure bar. */
function FlowPanel({ pair }: { pair: Pair }) {
  const { compact: money } = useCurrency();

  return (
    <div className="divide-y divide-line-soft">
      {TIMEFRAMES.map((tf) => {
        const { buys, sells } = pair.txns[tf];
        const total = buys + sells;
        const buyShare = total > 0 ? (buys / total) * 100 : 50;

        return (
          <div key={tf} className="px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
                {TIMEFRAME_LABEL[tf]}
              </span>
              <span className="tnum font-mono text-[11px] text-ink-mid">
                {money(pair.volume[tf])} · {formatCount(total)} txns
              </span>
            </div>

            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-down/30">
              <div
                className="bg-up transition-[width] duration-500"
                style={{ width: `${buyShare}%` }}
              />
            </div>

            <div className="mt-1.5 flex justify-between">
              <span className="tnum font-mono text-[11px] text-up">
                {formatCount(buys)} buys
              </span>
              <span className="tnum font-mono text-[11px] text-down">
                {formatCount(sells)} sells
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PairDetail() {
  const { pairId } = useParams<{ pairId: string }>();
  const pairs = useMarketStore((s) => s.pairs);
  const pair = useMemo(() => pairs.find((p) => p.id === pairId), [pairs, pairId]);

  const watched = useScreenerStore((s) => (pairId ? s.watchlist.includes(pairId) : false));
  const toggleWatch = useScreenerStore((s) => s.toggleWatch);
  const { compact: money, priceText } = useCurrency();

  if (!pair) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <EmptyState
          title="Pair not found"
          description="This pair is not on the current board. It may have been delisted, or the link may be stale."
          action={
            <Link to="/screener">
              <Button variant="outline" size="sm">
                Back to the screener
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const chain = CHAINS[pair.chain];
  const socials = [
    { href: pair.socials.website, icon: Globe, label: 'Website' },
    { href: pair.socials.twitter, icon: Twitter, label: 'Twitter' },
    { href: pair.socials.telegram, icon: Send, label: 'Telegram' },
  ].filter((item) => item.href);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <Link
        to="/screener"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-low transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to screener
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3.5">
          <TokenAvatar
            symbol={pair.baseToken.symbol}
            chain={pair.chain}
            src={pair.imageUrl}
            size="lg"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
                {pair.baseToken.symbol}
                <span className="text-ink-dim">/{pair.quoteToken.symbol}</span>
              </h1>
              <ChainChip chain={pair.chain} />
              <Badge>{pair.dex}</Badge>
              {pair.trendingRank && (
                <Badge tone="warn">#{pair.trendingRank} trending</Badge>
              )}
              {pair.tracked && !pair.tracked.pinned && (
                <Badge tone="warn">Unverified ticker match</Badge>
              )}
            </div>

            <p className="mt-1 truncate text-sm text-ink-low">
              {pair.baseToken.name} · created {formatAge(pair.createdAt)} ago
            </p>

            {socials.length > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="rounded-sm border border-line bg-sunken p-1.5 text-ink-low transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <social.icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 lg:flex-nowrap lg:flex-col lg:items-end">
          <div className="lg:text-right">
            <PriceText
              usd={pair.priceUsd}
              live
              className="font-display text-3xl font-bold text-ink"
            />
            <div className="mt-1 flex items-center gap-2 lg:justify-end">
              <ChangeValue value={pair.change.h24} arrow size="md" />
              <span className="text-xs text-ink-low">24h</span>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            <Button
              variant={watched ? 'primary' : 'outline'}
              size="md"
              onClick={() => toggleWatch(pair.id)}
            >
              <Star className="h-3.5 w-3.5" fill={watched ? 'currentColor' : 'none'} />
              {watched ? 'Watching' : 'Watch'}
            </Button>
            <a
              href={`${chain.explorer}/address/${pair.pairAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="md">
                Explorer
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line md:grid-cols-4">
        {[
          { label: 'Liquidity', value: money(pair.liquidityUsd) },
          { label: '24h volume', value: money(pair.volume.h24) },
          { label: 'Market cap', value: money(pair.marketCap) },
          { label: 'FDV', value: money(pair.fdv) },
        ].map((item) => (
          <div key={item.label} className="bg-canvas px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
              {item.label}
            </p>
            <p className="tnum mt-1 font-mono text-lg font-semibold text-ink">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Panel className="overflow-hidden">
            <PriceChart pair={pair} />
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Live trades"
              subtitle={`${pair.baseToken.symbol}/${pair.quoteToken.symbol} on ${pair.dex}`}
            />
            <TradeTape pair={pair} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="overflow-hidden" elevation="raised">
            <PnlCard pair={pair} />
          </Panel>

          <Panel className="overflow-hidden">
            <ProfitCalculator pair={pair} />
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Performance" />
            <ChangeGrid pair={pair} />
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Order flow" subtitle="Buy and sell pressure" />
            <FlowPanel pair={pair} />
          </Panel>

          <Panel className="overflow-hidden">
            <SecurityPanel security={pair.security} />
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Pair info" />
            <div className="divide-y divide-line-soft">
              <AddressRow
                label={`${pair.baseToken.symbol} token`}
                address={pair.baseToken.address}
                explorer={chain.explorer}
              />
              <AddressRow
                label="Pair contract"
                address={pair.pairAddress}
                explorer={chain.explorer}
              />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[11px] text-ink-low">Makers (24h)</span>
                <span className="tnum font-mono text-[11px] text-ink-mid">
                  {pair.makers24h < 0 ? '—' : formatCompact(pair.makers24h)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[11px] text-ink-low">
                  Price in {pair.quoteToken.symbol}
                </span>
                <span className="tnum font-mono text-[11px] text-ink-mid">
                  {pair.priceNative.toPrecision(4)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[11px] text-ink-low">Network</span>
                <span className={cn('text-[11px]')} style={{ color: chain.colorVar }}>
                  {chain.name}
                </span>
              </div>
            </div>
          </Panel>

          <p className="px-1 text-[11px] leading-relaxed text-ink-dim">
            Reference price {priceText(pair.priceUsd)}. Market data is for
            information only and is not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
