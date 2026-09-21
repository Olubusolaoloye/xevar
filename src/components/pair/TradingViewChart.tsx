import { useEffect, useRef, useState } from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import type { Pair } from '@/data/types';

/**
 * TradingView's embeddable chart, as a plain URL.
 *
 * Their copy-paste snippet injects a loader script that builds this iframe for
 * you, and that indirection is what broke the first attempt: the loader hunts
 * for a wrapper with the class `tradingview-widget-container` and a
 * `__widget` child to mount into, finds neither in a React tree that styles
 * with utility classes, and silently renders nothing at all. A blank panel
 * with no error is the worst failure this app can produce.
 *
 * Pointing an iframe straight at the endpoint the loader would have used
 * removes the script, the required class names, the `document.currentScript`
 * timing and the mutation of a React-owned node — and leaves an element React
 * can render, key and tear down like any other.
 */
const EMBED_BASE = 'https://s.tradingview.com/widgetembed/';

/** How long to wait for the frame before deciding the host is unreachable. */
const LOAD_TIMEOUT_MS = 8_000;

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

/** The embed URL for one symbol, in one theme. */
export function embedUrl(symbol: string, theme: 'light' | 'dark'): string {
  const params = new URLSearchParams({
    symbol,
    interval: '60',
    theme,
    style: '3', // area, matching the built-in chart's read-the-trend intent
    locale: 'en',
    timezone: 'Etc/UTC',
    // The board decides which pair this page is about; letting the frame
    // navigate elsewhere would put a different token under this URL.
    symboledit: '0',
    saveimage: '0',
    hideideas: '1',
    hidesidetoolbar: '1',
    // Let the panel behind it supply the surface colour, so the frame does not
    // paint a rectangle that disagrees with the card in light mode.
    toolbarbg: 'rgba(0,0,0,0)',
  });
  return `${EMBED_BASE}?${params.toString()}`;
}

/**
 * The pair chart, drawn by TradingView.
 *
 * The whole point is that no market data passes through this app: the frame
 * fetches its own history from TradingView's servers. Every failure the
 * built-in chart can hit — a pool our provider never indexed, a rate limit, an
 * unreachable host — simply does not apply, because we are not the one
 * fetching.
 *
 * What we still cannot see is *inside* the frame. A symbol TradingView does
 * not carry renders their "invalid symbol" notice cross-origin, which is not
 * ours to read. What we can tell is whether the frame ever loaded at all, and
 * a frame that never loads means the host is blocked or unreachable — so that
 * case falls back rather than leaving somebody staring at nothing.
 */
export function TradingViewChart({
  pair,
  onUnavailable,
}: {
  pair: Pair;
  /** Called when the frame never loads, so the caller can show its own chart. */
  onUnavailable?: () => void;
}) {
  const { mode } = useChartTheme();
  const symbol = tradingViewSymbol(pair);
  const [loaded, setLoaded] = useState(false);
  const timedOut = useRef(false);

  useEffect(() => {
    if (!symbol) return;
    setLoaded(false);
    timedOut.current = false;

    const timer = setTimeout(() => {
      // `onLoad` never fired: the request to TradingView did not complete, so
      // there is nothing in the frame and never will be.
      timedOut.current = true;
      onUnavailable?.();
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new callback
    // identity from the parent must not restart the load timer.
  }, [symbol, mode]);

  if (!symbol) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-low">
        This listing has no pool address, so there is no TradingView symbol to
        resolve. The built-in chart still works.
      </div>
    );
  }

  return (
    <iframe
      // Keyed so a theme change mounts a new frame: the embed reads its
      // appearance from the URL, once, and cannot be restyled in place.
      key={`${symbol}-${mode}`}
      src={embedUrl(symbol, mode)}
      title={`${pair.baseToken.symbol} price chart on TradingView`}
      className="h-full w-full border-0"
      allow="clipboard-write"
      referrerPolicy="origin"
      onLoad={() => setLoaded(true)}
      onError={() => onUnavailable?.()}
      style={{ visibility: loaded || !timedOut.current ? 'visible' : 'hidden' }}
    />
  );
}
