<div align="center">

# PanScreener

**Every pair. Every chain. One board.**

A live multi-chain DEX screener — pair-level price, liquidity, order flow and
automated risk signals across eight networks, with threshold alerts and
shareable P&L cards.

</div>

---

## What it is

PanScreener is a dense, real-time market board in the tradition of DEX
screeners, rebuilt around a strict design-token system and a swappable data
layer.

- **Screener** — every listed pair, sortable on each column, with rolling
  windows (5m / 1h / 6h / 24h), buy-sell pressure bars, inline sparklines and
  live price flashing.
- **Filters** — one-click presets (Trending, New listings, Gainers, Losers)
  plus network, exchange, liquidity, volume and age thresholds. The exchange
  list is derived from the pairs actually on the board, not hardcoded.
- **Pair pages** — price chart over five ranges, a live trade tape, order-flow
  breakdown per window, and a risk-signal panel.
- **Alerts** — threshold triggers on price, 24h change, liquidity or volume,
  evaluated against the live board on every refresh. Edge-triggered: an alert
  fires when its condition is crossed, then re-arms once it clears.
- **P&L** — record a position on any token page and track it live, or export a
  shareable card.
- **Command palette** — `⌘K` (or `/`) to reach any pair or page instantly.
- **Portfolio** — not built yet; the screen says so rather than showing
  invented balances.

### No invented data

There is no demo, sample or seeded market anywhere in the app. Every price,
liquidity figure, candle and trade comes from a live provider. Where a provider
cannot be reached the app says so and renders nothing — it never fills the gap
with a generated series, because a plausible-looking chart of a market that
never happened is the one thing a market app must not draw.

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

## Listing a token

Market data is free; presentation is not.

Anyone can have a token tracked by supplying a contract address — price,
liquidity, volume and flow are facts about a public pool, and nobody needs to
pay to have facts reported. A logo, a banner, a description and outbound social
links are *claims by whoever submitted them*, so they appear only after a
payment is confirmed and an admin has reviewed the submission.

| Listing status | What the token page shows |
| --- | --- |
| `tracking` | Market data only |
| `pending` | Market data only, submission queued for review |
| `approved` | Logo, banner, description and links go live |
| `rejected` | Market data only, with a reason shown to the submitter |

A missing status is treated as `tracking`, never as `approved` — a row written
by a client that does not know about this workflow must not be able to publish
a banner and a set of links by omitting a column.

**The flow:** a developer creates an account at `/developer`, adds a contract
address (tracked immediately), fills in the details they want shown, sends the
$50 fee, pastes the transaction hash and submits. The submission lands in the
admin review queue with the hash linked to the chain's explorer beside the
address and amount it should have carried. The admin can also autolist any
token directly, without a payment.

None of this is enforced in the app. Row-level security is what actually stops
a developer approving their own listing, marking it verified, featuring it,
reassigning it to another account, or editing it after review — see
`supabase/002_developer_listings.sql`. The client is a convenience; the
policies are the boundary.

**Verified** is a separate, stronger claim than approved: an admin asserting
that a listing is the project it says it is. Only an admin can set it.

**What is global vs local**

| Global (admin-controlled) | Local to each visitor |
| --- | --- |
| Listings and their presentation | Watchlist |
| Carousel adverts | Recorded positions and P&L |
| Refresh rate, verdict provider | Alerts and their history |
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
      dexscreener.ts  live pair prices, liquidity and flow
      geckoterminal.ts OHLCV candles and recent trades
  store/            zustand: market, screener, alerts, listings, prefs
  hooks/            feed lifecycle, price flash, currency, queries
  components/
    ui/             16 token-driven primitives
    brand/          logo and wordmark
    layout/         shell, rail, top bar, mobile nav, command palette
    screener/       table, row, card, filters, trending, presets
    pair/           chart, trade tape, risk panel
  pages/            Overview · Screener · PairDetail · Watchlist ·
                    MultiChart · Alerts · Settings · Admin · NotFound
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

Out of the box the board is assembled from DexScreener (prices, liquidity,
volume, transaction counts) and GeckoTerminal (candles and trades). Both are
free and keyless. A source that fails is reported as a failure rather than
substituted for — see **No invented data** above.

## Notes

- Read-only by design: PanScreener never requests a seed phrase or private
  key, never connects a wallet, and cannot sign transactions or move funds.
- Risk signals are automated heuristics, not audits.
- Nothing here is financial advice.
