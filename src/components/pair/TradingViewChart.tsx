import { useEffect, useRef } from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { Pair } from '@/data/types';

const WIDGET_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

/**
 * TradingView's symbol for an on-chain pool.
 *
 * Their DEX pairs are named `{BASE}{QUOTE}_{first six hex of the pool
 * address}`, upper-cased, with a `.USD` suffix for the dollar-denominated
 * series — WKC/WBNB on PancakeSwap at 0x933477eb… is `WKCWBNB_933477.USD`.
 * That makes the symbol derivable from what a listing already carries, with no
 * lookup and no second data source to keep in step.
 *
 * The suffix is not decoration. Without it the symbol is the same pool priced
 * in the quote asset, so a token would be charted in WBNB while every other
 * figure on the page is in dollars — two different numbers for one price,
 * which is exactly the confusion this board exists to avoid.
 *
 * The exchange prefix (`PANCAKESWAP:`) is deliberately omitted: it would have
 * to be mapped from the provider's DEX name, which varies by version and
 * spelling, and TradingView resolves the bare symbol on its own.
 *
 * Null when the pool address is missing or malformed, because a guessed symbol
 * resolves to somebody else's market — the one failure mode worse than showing
 * no chart at all.
 */
export function tradingViewSymbol(pair: Pair): string | null {
  const address = pair.pairAddress?.trim() ?? '';
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return null;

  const base = pair.baseToken.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const quote = pair.quoteToken.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!base || !quote) return null;

  return `${base}${quote}_${address.slice(2, 8).toUpperCase()}.USD`;
}

/**
 * The pair chart, drawn by TradingView.
 *
 * The whole point is that no market data passes through this app: the widget
 * is an iframe that fetches its own history from TradingView's servers. Every
 * failure the built-in chart can hit — a pool our provider never indexed, a
 * rate limit, an unreachable host — simply does not apply here, because we are
 * not the one fetching.
 *
 * The cost is that we cannot see inside it. A symbol TradingView does not
 * carry renders *their* "invalid symbol" notice in a cross-origin frame we are
 * not allowed to read, so the caller offers a way back to the built-in chart
 * rather than pretending this can be detected.
 */
export function TradingViewChart({ pair }: { pair: Pair }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mode } = useChartTheme();
  const symbol = tradingViewSymbol(pair);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !symbol) return;

    /* Rebuilt from scratch on a theme change. The embed widget reads its
       config once, at construction, and exposes no way to restyle a live
       instance — so following light/dark means a new iframe, not an update. */
    container.innerHTML = '';

    const mount = document.createElement('div');
    mount.className = 'h-full w-full';
    container.appendChild(mount);

    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      symbol,
      theme: mode,
      autosize: true,
      interval: '60',
      timezone: 'Etc/UTC',
      style: '3', // area, matching the built-in chart's read-the-trend intent
      locale: 'en',
      hide_top_toolbar: false,
      hide_legend: false,
      // The board decides which pair this page is about; letting the widget
      // navigate elsewhere would put a different token under this URL.
      allow_symbol_change: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol, mode]);

  if (!symbol) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-low">
        This listing has no pool address, so there is no TradingView symbol to
        resolve. The built-in chart still works.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
