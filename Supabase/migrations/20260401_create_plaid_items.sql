-- Stores Plaid access tokens per linked bank account.
-- One user can have multiple rows (Sparkasse + N26 + Deutsche Bank, etc.)
create table if not exists plaid_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null unique,          -- Plaid item_id (one per institution link)
  access_token text not null,                -- Plaid access_token (encrypted at rest by Supabase)
  institution_name text,                     -- e.g. "Sparkasse", "N26" (for display)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast per-user lookups (transactions/balances queries)
create index if not exists idx_plaid_items_user_id on plaid_items(user_id);

-- Row-Level Security: users can only access their own linked banks
alter table plaid_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'plaid_items' and policyname = 'Users can view their own plaid items') then
    create policy "Users can view their own plaid items"
      on plaid_items for select
      using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'plaid_items' and policyname = 'Users can insert their own plaid items') then
    create policy "Users can insert their own plaid items"
      on plaid_items for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'plaid_items' and policyname = 'Users can delete their own plaid items') then
    create policy "Users can delete their own plaid items"
      on plaid_items for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Service role (used by the API) bypasses RLS, so server-side upserts work.
-- The API uses SUPABASE_SERVICE_ROLE_KEY which has full access.

-- Auto-update updated_at on changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop and recreate trigger (triggers don't support IF NOT EXISTS)
drop trigger if exists plaid_items_updated_at on plaid_items;
create trigger plaid_items_updated_at
  before update on plaid_items
  for each row execute function update_updated_at();
