/**
 * Live price source.
 *
 * Binance publishes an unauthenticated all-market ticker stream, which gives
 * PanScreener genuine real-time prices for every major asset without an API
 * key. Only symbols quoted in USDT are relevant here; everything else on the
 * board is driven by the simulated walk in `feed.ts`.
 *
 * The socket is deliberately defensive: browsers drop websockets aggressively
 * on tab suspend, and the stream itself is high-volume, so this reconnects with
 * exponential backoff and throttles how often it wakes the UI.
 */

/** Connection state of this socket alone — distinct from the board's status. */
export type SocketStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface Ticker {
  /** Base asset symbol, already stripped of the USDT suffix, e.g. `"ETH"`. */
  symbol: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
}

type TickerHandler = (tickers: Map<string, Ticker>) => void;
type StatusHandler = (status: SocketStatus) => void;

const STREAM_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';

/** The stream fires several times a second; the UI does not need that. */
const EMIT_INTERVAL_MS = 1_200;
const MAX_BACKOFF_MS = 30_000;

export class BinanceTickerSource {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private emitTimer: ReturnType<typeof setInterval> | null = null;
  private attempt = 0;
  private disposed = false;

  private latest = new Map<string, Ticker>();
  private dirty = false;

  private onTickers: TickerHandler;
  private onStatus: StatusHandler;

  constructor(onTickers: TickerHandler, onStatus: StatusHandler) {
    this.onTickers = onTickers;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.disposed) return;
    if (typeof WebSocket === 'undefined') {
      this.onStatus('offline');
      return;
    }

    this.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(STREAM_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.onStatus('live');
      this.startEmitting();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        if (!Array.isArray(payload)) return;

        for (const entry of payload) {
          const raw: string = entry.s;
          if (!raw?.endsWith('USDT')) continue;

          const price = Number.parseFloat(entry.c);
          if (!Number.isFinite(price)) continue;

          this.latest.set(raw.slice(0, -4), {
            symbol: raw.slice(0, -4),
            priceUsd: price,
            change24h: Number.parseFloat(entry.P) || 0,
            volume24h: Number.parseFloat(entry.q) || 0,
          });
        }
        this.dirty = true;
      } catch {
        // A malformed frame is not worth tearing the connection down for.
      }
    };

    socket.onerror = () => {
      // `onclose` always follows, and owns the reconnect.
    };

    socket.onclose = () => {
      this.stopEmitting();
      if (!this.disposed) this.scheduleReconnect();
    };
  }

  private startEmitting() {
    this.stopEmitting();
    this.emitTimer = setInterval(() => {
      if (!this.dirty) return;
      this.dirty = false;
      this.onTickers(this.latest);
    }, EMIT_INTERVAL_MS);
  }

  private stopEmitting() {
    if (this.emitTimer) {
      clearInterval(this.emitTimer);
      this.emitTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.onStatus('reconnecting');

    // Exponential backoff with jitter, so a dropped provider does not get
    // hammered by every open tab at the same instant.
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt);
    const delay = base * (0.7 + Math.random() * 0.6);
    this.attempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  dispose() {
    this.disposed = true;
    this.stopEmitting();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
