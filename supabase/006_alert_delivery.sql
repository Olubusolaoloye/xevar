-- ============================================================================
-- Alerts that reach you when the app is closed
-- ----------------------------------------------------------------------------
-- Alerts used to live in localStorage and were evaluated only while a tab was
-- open, which meant an alert was a thing that fired if you happened to already
-- be looking. These tables move them to the server for signed-in users, where
-- a scheduled function evaluates them against live prices and dispatches a Web
-- Push notification and an email.
--
-- Signed-out visitors keep the local alerts they already have. There is no way
-- to push to a device the app has never met, and requiring an account to set
-- any alert at all would take a working feature away from everyone who has one
-- today.
--
-- The edge-trigger state lives here too, in ps_alerts.condition_met. That is
-- what stops an alert firing on every poll while a price sits one cent past
-- its threshold: it fires on the transition into the condition, then stays
-- quiet until the condition clears and is entered again. The client applies
-- exactly the same rule; see src/data/alertRules.ts, which both sides share.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The alerts themselves
-- ---------------------------------------------------------------------------

create table if not exists public.ps_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  /* The board's own pair id, "bsc-0xabc…". Denormalised alongside the chain
     and token address because the dispatcher has to re-fetch this pair from
     the market API without the board in front of it. */
  pair_id       text not null,
  pair_label    text not null,
  chain         text not null,
  token_address text,

  metric        text not null check (
                  metric in ('price', 'marketCap', 'change24h', 'liquidity', 'volume24h')),
  comparator    text not null check (comparator in ('above', 'below')),
  threshold     double precision not null check (threshold = threshold), -- rejects NaN
  enabled       boolean not null default true,

  /* Server-owned edge-trigger state. Never written by the client: a browser
     that could set this could silence an alert or make it fire on demand. */
  condition_met  boolean not null default false,
  last_fired_at  timestamptz,
  last_checked_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ps_alerts_user on public.ps_alerts (user_id, created_at desc);
-- The dispatcher's own query: every enabled alert, grouped by what to fetch.
create index if not exists ps_alerts_due on public.ps_alerts (enabled, chain) where enabled;

-- ---------------------------------------------------------------------------
-- Where to push
-- ---------------------------------------------------------------------------
--
-- One row per browser per device. The endpoint is the push service's own URL
-- and is unique by construction, so re-subscribing the same browser updates
-- the row rather than accumulating duplicates that would each deliver a copy.

create table if not exists public.ps_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  -- The browser's public key and auth secret, used to encrypt the payload so
  -- the push service relays something it cannot read.
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  /* Consecutive failures. A push service answers 404 or 410 for a subscription
     the browser has thrown away, and those are pruned immediately; anything
     else is counted, so a service having a bad hour does not cost somebody
     their notifications. */
  failure_count integer not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists ps_push_user on public.ps_push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- What was sent
-- ---------------------------------------------------------------------------
--
-- Both the in-app history and the record of what actually went out. Kept
-- separate from ps_alerts so deleting an alert does not erase the fact that it
-- fired, and so a delivery that failed can be seen rather than inferred.

create table if not exists public.ps_alert_deliveries (
  id           uuid primary key default gen_random_uuid(),
  alert_id     uuid references public.ps_alerts (id) on delete set null,
  user_id      uuid not null references auth.users (id) on delete cascade,

  pair_id      text not null,
  pair_label   text not null,
  metric       text not null,
  comparator   text not null,
  threshold    double precision not null,
  /** The reading that crossed, recorded at the moment it did. */
  value        double precision not null,

  fired_at     timestamptz not null default now(),
  push_sent    boolean not null default false,
  email_sent   boolean not null default false,
  /** Why a channel did not go out, when one did not. */
  note         text,
  read         boolean not null default false
);

create index if not exists ps_deliveries_user
  on public.ps_alert_deliveries (user_id, fired_at desc);

-- ---------------------------------------------------------------------------
-- Per-person channel preferences
-- ---------------------------------------------------------------------------

create table if not exists public.ps_notification_prefs (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  push_enabled  boolean not null default true,
  email_enabled boolean not null default true,
  /* Null means "the address on the account". Stored separately so somebody can
     send alerts somewhere other than the address they sign in with without
     changing their login. */
  email_address text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Keep timestamps honest, and keep the client out of server-owned columns
-- ---------------------------------------------------------------------------

create or replace function public.ps_guard_alert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();

  if tg_op = 'INSERT' then
    new.user_id = auth.uid();
    new.created_at = now();
    -- A new alert starts un-armed regardless of what the client sent, so it
    -- cannot be created pre-fired.
    new.condition_met = false;
    new.last_fired_at = null;
  else
    new.user_id = old.user_id;
    new.created_at = old.created_at;

    /* The dispatcher runs as the service role and is the only thing allowed to
       move the edge-trigger state. A client that could write it could silence
       an alert forever, or make it fire on every poll.

       Toggling an alert off and on again re-arms it, which matches what the
       client did locally: switching an alert back on should not fire it for a
       condition that was already true while it was off. */
    if auth.uid() is not null then
      if new.enabled and not old.enabled then
        new.condition_met = false;
      else
        new.condition_met = old.condition_met;
      end if;
      new.last_fired_at = old.last_fired_at;
      new.last_checked_at = old.last_checked_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ps_alerts_guard on public.ps_alerts;
create trigger ps_alerts_guard before insert or update on public.ps_alerts
  for each row execute function public.ps_guard_alert();

drop trigger if exists ps_notification_prefs_touch on public.ps_notification_prefs;
create trigger ps_notification_prefs_touch before update on public.ps_notification_prefs
  for each row execute function public.ps_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- Everything here is private. Unlike listings and reviews there is no public
-- read at all: an alert says what somebody is watching and at what price, and
-- a push endpoint is a capability to send that person a notification.
--
-- The dispatcher reads across users, but it runs as the service role, which
-- bypasses RLS entirely. No policy needs to mention it.

alter table public.ps_alerts             enable row level security;
alter table public.ps_push_subscriptions enable row level security;
alter table public.ps_alert_deliveries   enable row level security;
alter table public.ps_notification_prefs enable row level security;

drop policy if exists ps_alerts_own on public.ps_alerts;
create policy ps_alerts_own on public.ps_alerts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ps_push_own on public.ps_push_subscriptions;
create policy ps_push_own on public.ps_push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* Deliveries are readable and dismissable by their owner, and created only by
   the dispatcher. A client that could insert one could fabricate an alert
   history for itself, which is harmless but dishonest — the log should only
   ever say what actually happened. */
drop policy if exists ps_deliveries_read on public.ps_alert_deliveries;
create policy ps_deliveries_read on public.ps_alert_deliveries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ps_deliveries_update on public.ps_alert_deliveries;
create policy ps_deliveries_update on public.ps_alert_deliveries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ps_deliveries_delete on public.ps_alert_deliveries;
create policy ps_deliveries_delete on public.ps_alert_deliveries
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists ps_prefs_own on public.ps_notification_prefs;
create policy ps_prefs_own on public.ps_notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
