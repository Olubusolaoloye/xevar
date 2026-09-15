-- ============================================================================
-- Developer listings
-- ----------------------------------------------------------------------------
-- Adds the paid-listing workflow to ps_listings.
--
-- The shape of the rule: market data is free, presentation is not. Anyone can
-- have a token tracked by handing over a contract address — price, liquidity
-- and flow are facts about a public pool. A logo, a banner, a description and
-- outbound social links are claims by whoever submitted them, and they appear
-- only after a payment is confirmed and an admin has reviewed the submission.
--
-- Everything below is enforced in Postgres rather than in the app, for the
-- same reason as the rest of this schema: the publishable key ships inside the
-- JavaScript bundle, so a rule enforced in the client is decoration.
-- ============================================================================

alter table public.ps_listings
  add column if not exists status          text        not null default 'tracking',
  add column if not exists verified        boolean     not null default false,
  add column if not exists owner_id        uuid        references auth.users (id) on delete set null,
  add column if not exists payment_tx_hash text,
  add column if not exists contact_email   text,
  add column if not exists submitted_at    timestamptz,
  add column if not exists reviewed_at     timestamptz,
  add column if not exists review_note     text;

-- 'tracking' is the default on purpose. A row written by a client that does
-- not know about this workflow must not publish a banner and a set of outbound
-- links simply by omitting a column.
alter table public.ps_listings
  drop constraint if exists ps_listings_status_check;
alter table public.ps_listings
  add constraint ps_listings_status_check
  check (status in ('tracking', 'pending', 'approved', 'rejected'));

-- A submitted hash is either absent or a real 32-byte transaction hash. This
-- is a shape check, not proof of payment: only the admin review confirms that
-- the transaction exists, went to the right address and carried the right
-- amount.
alter table public.ps_listings
  drop constraint if exists ps_listings_tx_hash_check;
alter table public.ps_listings
  add constraint ps_listings_tx_hash_check
  check (payment_tx_hash is null or payment_tx_hash ~ '^0x[0-9a-fA-F]{64}$');

create index if not exists ps_listings_owner_idx on public.ps_listings (owner_id);
create index if not exists ps_listings_status_idx on public.ps_listings (status);

-- ---------------------------------------------------------------------------
-- Timestamps the submitter cannot forge
-- ---------------------------------------------------------------------------

create or replace function public.ps_stamp_listing_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Set server-side rather than accepted from the client: a developer could
  -- otherwise backdate their own submission to jump a review queue.
  if new.status = 'pending' and coalesce(old.status, '') is distinct from 'pending' then
    new.submitted_at := now();
  end if;

  if new.status in ('approved', 'rejected')
     and coalesce(old.status, '') is distinct from new.status then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists ps_listings_review_stamp on public.ps_listings;
create trigger ps_listings_review_stamp
  before insert or update on public.ps_listings
  for each row execute function public.ps_stamp_listing_review();

-- ---------------------------------------------------------------------------
-- What a developer may do
-- ---------------------------------------------------------------------------
--
-- The admin policy (ps_listings_write, FOR ALL) already exists and is
-- unaffected: permissive policies OR together, so an admin keeps full control
-- including the power to autolist, approve, and set `verified`.
--
-- These add a strictly narrower lane for everyone else.

-- Insert: your own row, awaiting review, unverified, unfeatured.
drop policy if exists ps_listings_dev_insert on public.ps_listings;
create policy ps_listings_dev_insert on public.ps_listings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status in ('tracking', 'pending')
    and verified = false
    and featured = false
  );

-- Update: your own row, and only while it is not already approved.
--
-- `using` is evaluated against the row as it stands and `with check` against
-- the row as it would become, so both halves are required:
--   * without `using`, a developer could edit somebody else's listing;
--   * without `with check`, they could set verified = true, flip status to
--     'approved', hand the row to another owner, or feature themselves.
--
-- Excluding 'approved' from `using` is deliberate. Once a submission has been
-- reviewed, its banner and outbound links are what the reviewer saw; letting
-- the submitter edit them afterwards would make the review meaningless. An
-- approved listing is changed by an admin.
drop policy if exists ps_listings_dev_update on public.ps_listings;
create policy ps_listings_dev_update on public.ps_listings
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and status in ('tracking', 'pending', 'rejected')
  )
  with check (
    owner_id = (select auth.uid())
    and status in ('tracking', 'pending')
    and verified = false
    and featured = false
  );

-- Delete: withdraw your own submission, as long as it is not live.
drop policy if exists ps_listings_dev_delete on public.ps_listings;
create policy ps_listings_dev_delete on public.ps_listings
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and status in ('tracking', 'pending', 'rejected')
  );

-- ---------------------------------------------------------------------------
-- The two listings the operator vouches for
-- ---------------------------------------------------------------------------

update public.ps_listings
set status = 'approved', verified = true
where upper(symbol) in ('WKC', 'BLIN');
