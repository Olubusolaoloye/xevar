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

## Backend

PanScreener is wired to a live Supabase project. Listings, adverts and settings
are global: the admin edits them once and every visitor on every device sees the
change, live over a websocket. No setup is needed to run or deploy the app —
`.env.production` carries the connection values, and they are committed on
purpose (see the comments in that file for why that is safe).

The schema lives in `supabase/001_panscreener.sql`, which is already applied.
Re-running it is harmless; it is written to be idempotent.

**Signing in**

Email and password at `/admin`. A magic link is kept as the secondary path,
because it is the only way back in if the password is forgotten — there is no
reset flow and no one who can reset it for you. The password can be changed
from the admin header once signed in.

For the link path to work, its redirect URL must be allowlisted in the
dashboard under **Authentication → URL Configuration**:

- `https://olubusolaoloye.github.io/xevar/admin` — the deployed site
- `http://localhost:5173/admin` — local development

**Who the admin is**

`devolufinodiv@gmail.com`, and only that address. It is enforced in Postgres,
not in the app: every write policy calls `ps_is_admin()`, which checks the
`ps_admin_allowlist` table. That table has row-level security on and *no
policies at all*, so it cannot be read or written through the API by anyone —
not even the admin. Moving admin rights means editing that row from the
dashboard.

Every object this app owns is prefixed `ps_`, because the project also hosts
another app in the same schema. Without the prefix, `create table if not
exists listings` would adopt the neighbour's table and `create or replace
function is_admin()` would silently overwrite its authorization logic.

The publishable key in `.env.production` is not a secret — it grants exactly
what the policies allow. The `service_role` key is a real secret and must never
reach the client.

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
