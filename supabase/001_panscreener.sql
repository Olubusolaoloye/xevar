-- ============================================================================
-- PanScreener backend
-- ----------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- What it does:
--   * Creates the three tables the admin controls: listings, ad_slides and a
--     single-row app_settings.
--   * Makes every one of them readable by the public, and writable ONLY by one
--     allowlisted email address.
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

create table if not exists public.admin_allowlist (
  email text primary key
);

-- Change the address here to move admin rights. Deliberately a table rather
-- than a literal inside each policy, so it is inspectable and editable from
-- the dashboard without a migration.
insert into public.admin_allowlist (email)
values ('devolufinodiv@gmail.com')
on conflict (email) do nothing;

-- RLS on with no policies at all: unreachable through the API in either
-- direction. Only the dashboard or a service-role key can change who is admin,
-- so a signed-in admin cannot quietly add a second one.
alter table public.admin_allowlist enable row level security;

/*
  Why SECURITY DEFINER: the policies below need to read admin_allowlist, but
  RLS would block that read for the very users being checked. A definer
  function runs as its owner, so the lookup succeeds while the table itself
  stays sealed.

  search_path is pinned because a definer function inherits the caller's
  search_path otherwise, which is a privilege-escalation route.
*/
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table if not exists public.listings (
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
create unique index if not exists listings_chain_address_key
  on public.listings (chain, lower(address))
  where address is not null;

-- For ticker-only listings the same guarantee applies on the symbol.
create unique index if not exists listings_chain_symbol_key
  on public.listings (chain, upper(symbol))
  where address is null;

-- ---------------------------------------------------------------------------
-- Carousel adverts
-- ---------------------------------------------------------------------------

create table if not exists public.ad_slides (
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

create table if not exists public.app_settings (
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

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();

drop trigger if exists ad_slides_touch on public.ad_slides;
create trigger ad_slides_touch before update on public.ad_slides
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.listings     enable row level security;
alter table public.ad_slides    enable row level security;
alter table public.app_settings enable row level security;

-- Read: everyone, signed in or not. This is a public market board.
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings
  for select to anon, authenticated using (true);

drop policy if exists ad_slides_read on public.ad_slides;
create policy ad_slides_read on public.ad_slides
  for select to anon, authenticated using (true);

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to anon, authenticated using (true);

-- Write: the allowlisted address only.
--
-- `using` governs which existing rows may be touched and `with check` governs
-- the resulting row. Both are required — `using` alone would let an admin
-- write a row they could not then see, and `with check` alone would let anyone
-- delete.
drop policy if exists listings_write on public.listings;
create policy listings_write on public.listings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ad_slides_write on public.ad_slides;
create policy ad_slides_write on public.ad_slides
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------

-- Publishing these lets every open browser receive changes over a websocket,
-- so an edit lands on other devices without a reload. Realtime respects RLS,
-- so subscribers only ever receive rows they are allowed to read.
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.ad_slides;
alter publication supabase_realtime add table public.app_settings;

-- ---------------------------------------------------------------------------
-- Starting listings
-- ---------------------------------------------------------------------------

-- Deliberately no contract addresses: an address written from memory would
-- silently price a different token. These resolve by ticker and show as
-- unverified until an address is pinned from the admin screen.
insert into public.listings (chain, symbol, label, category, position)
values
  ('bsc',      'WKC',  'Wiki Cat', 'meme', 0),
  ('ethereum', 'BLIN', 'Blin',     'meme', 1)
on conflict do nothing;

insert into public.ad_slides (title, body, eyebrow, cta_label, cta_href, sponsored, position)
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
