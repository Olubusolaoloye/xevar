-- ============================================================================
-- One comment a day, one rating per person
-- ----------------------------------------------------------------------------
-- Reviews used to be one row per person per token, edited forever. That made a
-- token's community page a snapshot of opinion rather than a conversation: you
-- could say one thing about a project, once, and revising it erased what you
-- had said before.
--
-- Now a person may post again each day. The unique constraint goes, and a
-- 24-hour floor takes its place.
--
-- The rating does NOT accumulate with the comments. If every post carried a
-- fresh star, somebody could five-star a token daily and walk the score up on
-- their own. So the score reads each person's MOST RECENT rating and ignores
-- their earlier ones — one person, one vote, and as many comments as they have
-- days to write them.
-- ============================================================================

alter table public.ps_token_reviews
  drop constraint if exists ps_token_reviews_chain_address_user_id_key;

/* The floor is enforced here rather than in the client, for the usual reason:
   the anon key ships in the bundle, so a limit the browser enforces is a limit
   anyone can skip by calling the REST API directly.

   Twenty-three hours rather than twenty-four, deliberately. Somebody who
   comments at 9am and comes back at 9am the next day should not be told to
   wait another minute — a daily limit that drifts an hour later every day is
   the kind of small hostility people notice. */
create or replace function public.ps_enforce_daily_comment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare last_post timestamptz;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select max(created_at) into last_post
  from public.ps_token_reviews
  where chain = lower(trim(new.chain))
    and address = lower(trim(new.address))
    and user_id = coalesce(auth.uid(), new.user_id);

  if last_post is not null and last_post > now() - interval '23 hours' then
    raise exception using
      errcode = 'check_violation',
      message = 'You have already posted about this token today.';
  end if;

  return new;
end;
$$;

-- Runs after the normalising trigger, so it compares the folded chain and
-- address rather than whatever casing the client happened to send.
drop trigger if exists ps_token_reviews_daily on public.ps_token_reviews;
create trigger ps_token_reviews_daily
  before insert on public.ps_token_reviews
  for each row execute function public.ps_enforce_daily_comment();

/* The score's view of a person: their latest row only.

   Every other row they have written still shows as a comment; it simply does
   not get a second vote. */
create or replace view public.ps_token_ratings_current
with (security_invoker = true)
as
  select distinct on (chain, address, user_id)
    chain, address, user_id, rating, created_at
  from public.ps_token_reviews
  order by chain, address, user_id, created_at desc;

grant select on public.ps_token_ratings_current to anon, authenticated;
