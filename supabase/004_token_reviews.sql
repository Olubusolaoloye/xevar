-- ============================================================================
-- Community ratings and comments
-- ----------------------------------------------------------------------------
-- One review per person per token: a star rating and an optional comment.
-- These feed the "community strength" column on the compare page.
--
-- A review is keyed by chain + contract address rather than by listing id.
-- Reviews are about the token, and a listing can be removed and re-added, or
-- never exist at all — a token on the curated watchlist can be reviewed
-- without anybody having listed it. Tying reviews to a listing row would
-- silently destroy them the day an admin tidies the board.
--
-- Addresses are stored lowercased by a trigger, so the same contract typed in
-- checksum casing and in lowercase is one token and not two.
-- ============================================================================

create table if not exists public.ps_token_reviews (
  id          uuid primary key default gen_random_uuid(),
  chain       text not null,
  address     text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Whole stars. A half-star scale reads as more precision than one person's
  -- opinion of a memecoin actually carries.
  rating      smallint not null check (rating between 1 and 5),
  -- Optional: a rating with no words is still a data point, and forcing a
  -- comment produces filler rather than insight.
  comment     text check (comment is null or char_length(comment) <= 1000),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One review per person per token. Re-reviewing edits the existing row,
  -- so nobody can weight the average by posting twenty times.
  unique (chain, address, user_id)
);

create index if not exists ps_token_reviews_token
  on public.ps_token_reviews (chain, address, created_at desc);

-- ---------------------------------------------------------------------------
-- Normalise the address, and keep the timestamps honest
-- ---------------------------------------------------------------------------

create or replace function public.ps_normalise_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.address = lower(trim(new.address));
  new.chain = lower(trim(new.chain));
  new.updated_at = now();

  /* Nobody may backdate a review or post one under another account, whatever
     the client sends. This assignment is the real guard, not the RLS policy:
     BEFORE triggers run first, so a forged user_id is rewritten to the caller
     here and the policy's `with check` then sees an already-honest row. Both
     are kept — the trigger makes forgery impossible, the policy makes it
     impossible even if this trigger were ever dropped. */
  if tg_op = 'INSERT' then
    new.created_at = now();
    new.user_id = auth.uid();
  else
    new.created_at = old.created_at;
    new.user_id = old.user_id;
  end if;

  -- An empty comment box is no comment, not an empty one — and surrounding
  -- whitespace is not part of what somebody wrote. Without the trim, "  ok  "
  -- and "ok" are two different strings and the comment's own length check
  -- counts padding against the author.
  new.comment = nullif(trim(coalesce(new.comment, '')), '');

  return new;
end;
$$;

drop trigger if exists ps_token_reviews_normalise on public.ps_token_reviews;
create trigger ps_token_reviews_normalise
  before insert or update on public.ps_token_reviews
  for each row execute function public.ps_normalise_review();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.ps_token_reviews enable row level security;

-- Read: everyone. The whole point is a public signal.
drop policy if exists ps_token_reviews_read on public.ps_token_reviews;
create policy ps_token_reviews_read on public.ps_token_reviews
  for select to anon, authenticated using (true);

-- Write: signed in, and only as yourself. `with check` pins the NEW row's
-- user_id to the caller, so a crafted insert cannot post as somebody else.
drop policy if exists ps_token_reviews_insert on public.ps_token_reviews;
create policy ps_token_reviews_insert on public.ps_token_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

-- Edit and delete your own only. `using` tests the row as it stands, so a
-- stranger's review is invisible to the update; `with check` tests the row
-- after, so an edit cannot hand the review to somebody else.
drop policy if exists ps_token_reviews_update on public.ps_token_reviews;
create policy ps_token_reviews_update on public.ps_token_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ps_token_reviews_delete on public.ps_token_reviews;
create policy ps_token_reviews_delete on public.ps_token_reviews
  for delete to authenticated
  using (user_id = auth.uid());

-- Moderation. Separate from the owner policies above rather than folded into
-- them with an `or`: the admin may remove anything, but still may not edit
-- somebody's words or post under their name.
drop policy if exists ps_token_reviews_admin_delete on public.ps_token_reviews;
create policy ps_token_reviews_admin_delete on public.ps_token_reviews
  for delete to authenticated
  using (public.ps_is_admin());

-- ---------------------------------------------------------------------------
-- Who wrote what
-- ---------------------------------------------------------------------------
--
-- Reviews are public, but auth.users is not and must never become readable —
-- it holds every registered address. So the display name is derived here, from
-- the reviewer's own email, and only the part before the @ survives:
-- "ada@example.com" shows as "ada". Enough for a person to recognise their own
-- review, not enough to harvest an address.
--
-- security definer because it reads auth.users; search_path pinned so the
-- elevated body cannot be redirected by a caller's schema.

create or replace function public.ps_review_author(uid uuid)
returns text
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select split_part(coalesce(email, 'someone'), '@', 1)
  from auth.users
  where id = uid;
$$;

revoke all on function public.ps_review_author(uuid) from public;
grant execute on function public.ps_review_author(uuid) to anon, authenticated;

-- A public, joinable view: the review plus its author's handle, and never the
-- address itself.
create or replace view public.ps_token_reviews_public
with (security_invoker = true)
as
  select
    r.id,
    r.chain,
    r.address,
    r.user_id,
    r.rating,
    r.comment,
    r.created_at,
    r.updated_at,
    public.ps_review_author(r.user_id) as author
  from public.ps_token_reviews r;

grant select on public.ps_token_reviews_public to anon, authenticated;
