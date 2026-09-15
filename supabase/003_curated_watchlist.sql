-- ============================================================================
-- The SMC DAO watchlist
-- ----------------------------------------------------------------------------
-- A curated list the operator controls, shown on every visitor's watchlist
-- until they dismiss it.
--
-- Entries are {symbol, address} pairs. The address is the identity — a ticker
-- is not unique, and several unrelated tokens ship as "WAR" or "PHT" — so the
-- symbol here is a label for the row while it resolves, nothing more.
--
-- Note what is deliberately NOT stored: the chain. Every address below is a
-- 20-byte EVM address, which is the same shape on BNB Chain, Ethereum, Base,
-- Arbitrum and a dozen others, and the same address can hold a different
-- contract on each. Writing a chain here would mean guessing one, and a wrong
-- guess does not fail loudly: it quotes a real, live, entirely different token.
-- So the chain is resolved at display time by the market provider, which is
-- the only party that actually knows. See src/data/curatedList.ts.
--
-- No listings are created either. Appearing on this list is not the same as
-- being listed on the board; the board is the admin's own, and joining the two
-- would let a watchlist edit quietly publish a token.
--
-- Dismissal is not stored here. It is a per-device preference in
-- localStorage, so it needs no account, and a visitor who has never signed in
-- can still make the list go away for good.
-- ============================================================================

alter table public.ps_app_settings
  add column if not exists curated_list_name text not null default 'SMC DAO',
  add column if not exists curated_list_tokens jsonb not null default '[]'::jsonb;

-- Shape check: a jsonb array, every element an object carrying a non-empty
-- symbol and an 0x-prefixed 20-byte address.
--
-- Enforced in Postgres rather than in the admin screen because the anon key
-- ships inside the JavaScript bundle — anything checked only in the client is
-- a suggestion. A malformed address would not error anywhere; it would just
-- resolve to nothing on every visitor's watchlist, forever, silently.
--
-- It lives in a function because a CHECK constraint may not contain a
-- subquery, and walking a jsonb array means `jsonb_array_elements`, which is
-- set-returning. Marked immutable so the constraint can use it: it reads only
-- its argument and touches no table.
create or replace function public.ps_curated_tokens_valid(tokens jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(tokens) = 'array'
     and jsonb_array_length(tokens) <= 24
     and not exists (
       select 1
       from jsonb_array_elements(tokens) as entry
       where jsonb_typeof(entry) is distinct from 'object'
          or coalesce(entry ->> 'symbol', '') = ''
          or coalesce(entry ->> 'address', '') !~ '^0x[0-9a-fA-F]{40}$'
     );
$$;

alter table public.ps_app_settings
  drop constraint if exists ps_app_settings_curated_tokens_check;
alter table public.ps_app_settings
  add constraint ps_app_settings_curated_tokens_check
  check (public.ps_curated_tokens_valid(curated_list_tokens));

-- The roster as supplied by the operator. WKC, DTG and ZDK lead because those
-- three were named for the list; the rest follow in the order they were given.
update public.ps_app_settings
set curated_list_name = 'SMC DAO',
    curated_list_tokens = jsonb_build_array(
      jsonb_build_object('symbol', 'WKC',       'address', '0x6Ec90334d89dBdc89E08A133271be3d104128Edb'),
      jsonb_build_object('symbol', 'DTG',       'address', '0xb1957BDbA889686EbdE631DF970ecE6A7571A1B6'),
      jsonb_build_object('symbol', 'ZDK',       'address', '0xcbeaad74dcb3a4227d0e6e67302402e06c119271'),
      jsonb_build_object('symbol', 'OCICAT',    'address', '0xe53d384cf33294c1882227ae4f90d64cf2a5db70'),
      jsonb_build_object('symbol', 'GTAN',      'address', '0xbD7909318b9Ca4ff140B840F69bB310a785d1095'),
      jsonb_build_object('symbol', 'TKC',       'address', '0x06dc293c250e2fb2416a4276d291803fc74fb9b5'),
      jsonb_build_object('symbol', 'TWD',       'address', '0xf00cD9366A13e725AB6764EE6FC8Bd21dA22786e'),
      jsonb_build_object('symbol', 'YUKAN',     'address', '0xd086B849a71867731D74D6bB5Df4f640de900171'),
      jsonb_build_object('symbol', 'PHT',       'address', '0x885c99a787be6b41cbf964174c771a9f7ec48e04'),
      jsonb_build_object('symbol', 'WAR',       'address', '0x57bfe2af99aeb7a3de3bc0c42c22353742bfd20d'),
      jsonb_build_object('symbol', 'BTCDRAGON', 'address', '0x1Ee8a2f28586e542af677eB15Fd00430f98d8fd8')
    )
where id = 1;
