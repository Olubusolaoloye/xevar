-- ============================================================================
-- PanScreener backend
-- ----------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- What it does:
--   * Creates the three tables the admin controls: ps_listings, ps_ad_slides
--     and a single-row ps_app_settings.
--   * Makes every one of them readable by the public, and writable ONLY by one
--     allowlisted email address.
--
-- Every object here carries a `ps_` prefix, including the helper functions.
-- That is not decoration. A Supabase project can host more than one app, and
-- unprefixed names like `listings`, `is_admin` or `touch_updated_at` are the
-- names every other app reaches for too. `create table if not exists` would
-- silently adopt a stranger's table, and `create or replace function` would
-- overwrite a stranger's `is_admin()` — taking its RLS policies with it, with
-- no error. The prefix makes this file safe to run in any project.
--
-- The single-admin rule is enforced by Postgres, not by the app. That matters:
-- the anon key ships inside the JavaScript bundle where anyone can read it, so
-- any rule enforced in the client is decoration. These policies cannot be
-- bypassed by editing the bundle, calling the REST API directly, or signing in
-- as a different user.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Who is allowed to write
-- ---------------------------------------------------------------------------

create table if not exists public.ps_admin_allowlist (
  email text primary key
);

-- Change the address here to move admin rights. Deliberately a table rather
-- than a literal inside each policy, so it is inspectable and editable from
-- the dashboard without a migration.
insert into public.ps_admin_allowlist (email)
values ('devolufinodiv@gmail.com')
on conflict (email) do nothing;

-- RLS on with no policies at all: unreachable through the API in either
-- direction. Only the dashboard or a service-role key can change who is admin,
-- so a signed-in admin cannot quietly add a second one.
--
-- Supabase's linter reports this as `rls_enabled_no_policy`. That finding is
-- expected here and must not be "fixed" by adding a read policy: the absence
-- of policies IS the seal. Adding one would publish the admin's address and,
-- worse, open the door to a second admin being appended.
alter table public.ps_admin_allowlist enable row level security;

/*
  Why SECURITY DEFINER: the policies below need to read admin_allowlist, but
  RLS would block that read for the very users being checked. A definer
  function runs as its owner, so the lookup succeeds while the table itself
  stays sealed.

  search_path is pinned because a definer function inherits the caller's
  search_path otherwise, which is a privilege-escalation route.
*/
create or replace function public.ps_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ps_admin_allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Signed-in callers only. The client asks this question exactly once, after a
-- session exists, so `anon` has no use for it — and a SECURITY DEFINER
-- function reachable without signing in is a wider door than this needs.
revoke all on function public.ps_is_admin() from public;
grant execute on function public.ps_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table if not exists public.ps_listings (
  id           uuid primary key default gen_random_uuid(),
  chain        text not null,
  symbol       text not null,
  address      text,
  pair_address text,
  label        text,
  category     text not null default 'meme',
  note         text,

  -- Presentation overrides. Anything set here beats what the market provider
  -- reports; prices are never stored, because those come from the pool.
  logo_url     text,
  cover_url    text,
  blurb        text,
  website      text,
  twitter      text,
  telegram     text,

  featured     boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One listing per token per chain. Two rows for the same contract would render
-- as duplicate rows quoting the same pool.
create unique index if not exists ps_listings_chain_address_key
  on public.ps_listings (chain, lower(address))
  where address is not null;

-- For ticker-only listings the same guarantee applies on the symbol.
create unique index if not exists ps_listings_chain_symbol_key
  on public.ps_listings (chain, upper(symbol))
  where address is null;

-- ---------------------------------------------------------------------------
-- Carousel adverts
-- ---------------------------------------------------------------------------

create table if not exists public.ps_ad_slides (
  id         uuid primary key default gen_random_uuid(),
  eyebrow    text,
  title      text not null,
  body       text,
  cta_label  text,
  cta_href   text,
  image_url  text,
  sponsored  boolean not null default true,
  enabled    boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Global settings
-- ---------------------------------------------------------------------------

create table if not exists public.ps_app_settings (
  -- A check constraint pinning the key makes this a single row by
  -- construction, so there is never a question of which settings apply.
  id                    integer primary key default 1 check (id = 1),
  poll_seconds          integer not null default 15
                          check (poll_seconds between 10 and 120),
  verdict_name          text not null default 'FatDev',
  verdict_url_template  text not null default 'https://fatdev.org/token/{address}',
  verdict_enabled       boolean not null default true,
  updated_at            timestamptz not null default now()
);

insert into public.ps_app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.ps_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ps_listings_touch on public.ps_listings;
create trigger ps_listings_touch before update on public.ps_listings
  for each row execute function public.ps_touch_updated_at();

drop trigger if exists ps_ad_slides_touch on public.ps_ad_slides;
create trigger ps_ad_slides_touch before update on public.ps_ad_slides
  for each row execute function public.ps_touch_updated_at();

drop trigger if exists ps_app_settings_touch on public.ps_app_settings;
create trigger ps_app_settings_touch before update on public.ps_app_settings
  for each row execute function public.ps_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.ps_listings     enable row level security;
alter table public.ps_ad_slides    enable row level security;
alter table public.ps_app_settings enable row level security;

-- Read: everyone, signed in or not. This is a public market board.
drop policy if exists ps_listings_read on public.ps_listings;
create policy ps_listings_read on public.ps_listings
  for select to anon, authenticated using (true);

drop policy if exists ps_ad_slides_read on public.ps_ad_slides;
create policy ps_ad_slides_read on public.ps_ad_slides
  for select to anon, authenticated using (true);

drop policy if exists ps_app_settings_read on public.ps_app_settings;
create policy ps_app_settings_read on public.ps_app_settings
  for select to anon, authenticated using (true);

-- Write: the allowlisted address only.
--
-- `using` governs which existing rows may be touched and `with check` governs
-- the resulting row. Both are required — `using` alone would let an admin
-- write a row they could not then see, and `with check` alone would let anyone
-- delete.
drop policy if exists ps_listings_write on public.ps_listings;
create policy ps_listings_write on public.ps_listings
  for all to authenticated
  using (public.ps_is_admin())
  with check (public.ps_is_admin());

drop policy if exists ps_ad_slides_write on public.ps_ad_slides;
create policy ps_ad_slides_write on public.ps_ad_slides
  for all to authenticated
  using (public.ps_is_admin())
  with check (public.ps_is_admin());

drop policy if exists ps_app_settings_write on public.ps_app_settings;
create policy ps_app_settings_write on public.ps_app_settings
  for all to authenticated
  using (public.ps_is_admin())
  with check (public.ps_is_admin());

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------

-- Publishing these lets every open browser receive changes over a websocket,
-- so an edit lands on other devices without a reload. Realtime respects RLS,
-- so subscribers only ever receive rows they are allowed to read.
-- `alter publication ... add table` errors if the table is already published,
-- which would abort a re-run partway. Adding only what is missing keeps this
-- file idempotent.
do $$
declare t text;
begin
  foreach t in array array['ps_listings', 'ps_ad_slides', 'ps_app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Starting listings
-- ---------------------------------------------------------------------------

-- Deliberately no contract addresses: an address written from memory would
-- silently price a different token. These resolve by ticker and show as
-- unverified until an address is pinned from the admin screen.
insert into public.ps_listings (chain, symbol, label, category, position)
values
  ('bsc',      'WKC',  'Wiki Cat', 'meme', 0),
  ('ethereum', 'BLIN', 'Blin',     'meme', 1)
on conflict do nothing;

insert into public.ps_ad_slides (title, body, eyebrow, cta_label, cta_href, sponsored, position)
values (
  'Every pair. Every chain. One board.',
  'PanScreener streams live DEX markets into a single instrument — price, depth, flow and risk signals, side by side, updating as they move.',
  'Live across 8 networks',
  'Open the screener',
  '/screener',
  false,
  0
)
on conflict do nothing;
