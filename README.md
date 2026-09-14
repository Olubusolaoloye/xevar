<div align="center">

# PanScreener

**Every pair. Every chain. One board.**

A live multi-chain DEX screener — pair-level price, liquidity, order flow and
automated risk signals across eight networks, with wallet portfolio tracking
and threshold alerts.

</div>

---

## What it is

PanScreener is a dense, real-time market board in the tradition of DEX
screeners, rebuilt around a strict design-token system and a swappable data
layer.

- **Screener** — 160 pairs across 8 networks, sortable on every column, with
  five rolling windows (5m / 1h / 6h / 24h), buy-sell pressure bars, inline
  sparklines and live price flashing.
- **Filters** — one-click presets (Trending, New pairs, Gainers, Losers, Top
  volume, Liquidity locked) plus network, exchange, liquidity, volume and age
  thresholds.
- **Pair pages** — price chart over five ranges, a live trade tape, order-flow
  breakdown per window, and a risk-signal panel.
- **Portfolio** — track any public EVM or Solana address; positions valued
  live, with cost basis, unrealised P&L and allocation by network.
- **Alerts** — threshold triggers on price, 24h change, liquidity or volume.
- **Command palette** — `⌘K` (or `/`) to reach any pair or page instantly.

## Running it

**Requires Node 18, 20, or 22+** (`.nvmrc` pins 20). Check with `node -v` — a
Node older than 18 is the most common reason `npm run dev` fails.

```bash
npm install
npm run dev          # http://localhost:3000
```

Port 3000 busy? `npm run dev -- --port 5180`.

```bash
npm run build        # typecheck + tests, then production bundle
npm run preview      # serve the built output
npm run typecheck    # types only
npm test             # unit tests
```

No API keys and no environment variables are required — the market APIs are
public and keyless.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unexpected token '??='` or similar syntax error on `npm install` | Node too old | Upgrade to Node 20 (`nvm use`) |
| `EADDRINUSE` | Port 3000 taken | `npm run dev -- --port 5180` |
| Blank page, console shows a bare-module import error | Stale Vite cache | `rm -rf node_modules/.vite && npm run dev` |
| Board shows **Demo data** | The market API is unreachable from your network | Check a corporate proxy or DNS filter is not blocking `api.dexscreener.com` |
| Routes 404 after deploying | Host is not rewriting to `index.html` | Use the included `netlify.toml` / `vercel.json` |

## Deploying

The repo ships config for both major static hosts. Both build with
`npm run build`, publish `dist`, and — critically — rewrite every path to
`index.html`, without which a client-side route 404s on refresh.

### GitHub Pages (no setup beyond one toggle)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
Enable it once: **Settings → Pages → Source → GitHub Actions**. The site then
lives at `https://<owner>.github.io/<repo>/`.

Two details that the workflow handles and that break a Vite SPA on Pages
otherwise:

- Project sites are served from `/<repo>/`, not the domain root, so the build
  runs with `VITE_BASE` set and the router takes its `basename` from it.
  Without both, either the assets 404 or no route ever matches.
- Pages has no rewrite rules, so the workflow copies `index.html` to
  `404.html`. Pages serves that for any unknown path, which is what lets a
  deep link like `/screener` boot the app instead of showing a 404.

### Netlify or Vercel

```bash
npx netlify-cli deploy --build --prod   # Netlify
npx vercel --prod                       # Vercel
```

Or point either host's dashboard at this repo; the committed config is picked
up automatically and every push to `main` redeploys. Both serve from the domain
root, so no `VITE_BASE` is needed.

## Backend (optional)

Without a backend PanScreener runs entirely in the browser and admin settings
stay local to one device. Point it at Supabase and listings, adverts and
settings become global: one admin edits them, everyone sees the change, live.

**Setup, once:**

1. Create a Supabase project (free).
2. Open the SQL editor and run `supabase/001_panscreener.sql`. It creates the
   tables, the row-level-security policies, and seeds the starting listings.
3. Authentication → Providers → enable **Email**, and turn *Confirm email* on.
   Under URL Configuration add your site URL to the redirect allowlist.
4. Authentication → Users → invite the admin address. The SQL allowlists
   `devolufinodiv@gmail.com`; change the `admin_allowlist` row to move it.
5. Project Settings → API: copy the URL and the publishable (anon) key into
   `.env` locally, and into the repository's Actions **variables** for deploys.

Both values are public by design. The anon key grants only what the policies
allow, and those live in Postgres — a modified bundle cannot write past them.
The `service_role` key is a real secret and must never reach the client.

**What is global vs local**

| Global (admin-controlled) | Local to each visitor |
| --- | --- |
| Listings and their presentation | Watchlist |
| Carousel adverts | Recorded positions and P&L |
| Refresh rate, verdict provider | Tracked wallets, alerts |
| | Theme, currency, density |

Personal data stays in the browser deliberately — nobody's watchlist belongs
in a shared database.

## Architecture

```
src/
  styles/
    tokens.css      ← the entire palette, in one file
    base.css        resets, scrollbars, the motion vocabulary
  data/
    types.ts        the domain model every source conforms to
    chains.ts       network + exchange registry
    query.ts        pure filter/sort engine
    feed.ts         composes the sources into one live stream
    sources/
      binance.ts    real websocket prices for majors
      mock.ts       seeded, deterministic long-tail market
  store/            zustand: market, screener, portfolio, prefs
  hooks/            feed lifecycle, price flash, currency, queries
  components/
    ui/             16 token-driven primitives
    brand/          logo and wordmark
    layout/         shell, rail, top bar, mobile nav, command palette
    screener/       table, row, card, filters, trending, presets
    pair/           chart, trade tape, risk panel
  pages/            Overview · Screener · PairDetail · Watchlist ·
                    Portfolio · Alerts · Settings · NotFound
```

### Re-skinning

The entire visual identity resolves to `src/styles/tokens.css`. No component
hardcodes a hex value. Replace the values in its `Brand ramp` and `Canvas`
blocks and every surface, border, chart stroke and piece of text follows —
Tailwind v4 generates the utilities from that `@theme` block.

### Swapping the data source

Every source produces the same shapes from `src/data/types.ts`. To add a real
on-chain API, implement a source under `src/data/sources/` and register it in
`src/data/feed.ts`. No component changes.

Out of the box, majors stream from Binance's public all-market ticker
websocket, while long-tail DEX pairs are generated from a fixed seed — so the
board is byte-identical on every reload, and metrics stay internally coherent
(liquidity, volume, transaction counts and volatility are derived from one
another rather than drawn independently).

## Notes

- Read-only by design: PanScreener tracks public addresses, never requests a
  seed phrase or private key, and cannot sign transactions or move funds.
- Risk signals are automated heuristics, not audits.
- Nothing here is financial advice.
