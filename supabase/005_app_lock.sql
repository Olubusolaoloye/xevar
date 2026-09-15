-- ============================================================================
-- Closing the app
-- ----------------------------------------------------------------------------
-- One switch the operator can throw to put the whole product behind a "coming
-- soon" screen.
--
-- The switch is enforced in two places, and only one of them is real.
--
-- The client gate is what people see: every route renders the closed screen
-- instead of the app. That is presentation. The bundle ships to the browser
-- and the publishable key ships with it, so anyone who wants to can edit the
-- JavaScript, or skip it entirely and call the REST API by hand.
--
-- So the read policies below are the actual lock. While the app is closed, the
-- board, the adverts and the reviews are unreadable through the API for
-- everyone except the admin — not hidden, not filtered, absent. That is what
-- makes "nobody can get in" a true statement rather than a decoration.
--
-- Deliberately still readable while closed: ps_app_settings itself. The client
-- has to be able to ask whether the app is closed in order to say so, and the
-- row holds nothing private — a poll interval, a verdict provider URL, the
-- curated list and this flag.
-- ============================================================================

alter table public.ps_app_settings
  add column if not exists app_locked boolean not null default false,
  add column if not exists lock_title text not null default 'Coming soon',
  add column if not exists lock_message text not null default
    'PanScreener is being prepared. Check back shortly.';

-- ---------------------------------------------------------------------------
-- Is the app open?
-- ---------------------------------------------------------------------------
--
-- security definer so the policies below can call it as anon, and stable so
-- one query does not re-read the settings row per candidate row.
--
-- coalesce matters: a project that has not run this migration, or somehow has
-- no settings row, must read as OPEN. Failing closed here would take the whole
-- product down over a missing row, which is a far worse failure than a lock
-- that did not engage.

create or replace function public.ps_app_open()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select not coalesce(
    (select app_locked from public.ps_app_settings where id = 1),
    false
  );
$$;

/* One function for the policies rather than `ps_app_open() or ps_is_admin()`
   written out in each.

   Not just for brevity. ps_is_admin() is granted to `authenticated` and
   revoked from `public`, so an anon caller hitting a policy that names it
   directly would be refused for lack of EXECUTE — the lock would throw errors
   at signed-out visitors instead of hiding rows from them. Wrapping it in a
   security definer function runs that inner call as the owner, while auth.jwt()
   still reports the real caller. */
create or replace function public.ps_can_read_board()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.ps_app_open() or public.ps_is_admin();
$$;

revoke all on function public.ps_app_open() from public;
revoke all on function public.ps_can_read_board() from public;
grant execute on function public.ps_app_open() to anon, authenticated;
grant execute on function public.ps_can_read_board() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gate the readable tables
-- ---------------------------------------------------------------------------

drop policy if exists ps_listings_read on public.ps_listings;
create policy ps_listings_read on public.ps_listings
  for select to anon, authenticated using (public.ps_can_read_board());

drop policy if exists ps_ad_slides_read on public.ps_ad_slides;
create policy ps_ad_slides_read on public.ps_ad_slides
  for select to anon, authenticated using (public.ps_can_read_board());

drop policy if exists ps_token_reviews_read on public.ps_token_reviews;
create policy ps_token_reviews_read on public.ps_token_reviews
  for select to anon, authenticated using (public.ps_can_read_board());
