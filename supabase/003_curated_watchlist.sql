-- ============================================================================
-- The SMC DAO watchlist
-- ----------------------------------------------------------------------------
-- A curated list the operator controls, shown on every visitor's watchlist
-- until they dismiss it.
--
-- Stored as plain symbols rather than listing ids, for two reasons. The list is
-- a statement about which projects belong to it, so it should survive a listing
-- being removed and re-added. And it means this migration does not have to know
-- which chain each token trades on — resolution happens against the board,
-- where the admin has already said.
--
-- Note what is deliberately NOT here: no listings are created for these
-- symbols. Guessing a chain would be as bad as guessing an address — a ticker
-- is not unique across networks, so a wrong guess quotes a different token that
-- happens to share the name. Any symbol with no matching listing is reported as
-- unlisted in both the admin screen and the watchlist.
--
-- Dismissal is also not stored here. It is a per-device preference in
-- localStorage, so it needs no account, and a visitor who has never signed in
-- can still make the list go away for good.
-- ============================================================================

alter table public.ps_app_settings
  add column if not exists curated_list_name text not null default 'SMC DAO',
  add column if not exists curated_list_symbols text[] not null default '{}';

alter table public.ps_app_settings
  drop constraint if exists ps_app_settings_curated_symbols_check;
alter table public.ps_app_settings
  add constraint ps_app_settings_curated_symbols_check
  check (
    array_length(curated_list_symbols, 1) is null
    or array_length(curated_list_symbols, 1) <= 24
  );

update public.ps_app_settings
set curated_list_name = 'SMC DAO',
    curated_list_symbols = array['WKC', 'DTG', 'ZDK']
where id = 1;
