-- MotionLens cloud sync schema (Phase 17).
-- Apply in the Supabase SQL editor, or via `supabase db push` with the CLI.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The extension's local id, used to dedupe on sync.
  client_id text not null,
  source_url text not null,
  saved_at timestamptz not null,
  graph jsonb not null,
  frameworks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  -- Non-null means the analysis is publicly viewable at /a/<share_id>.
  share_id text unique,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists analyses_user_id_idx on public.analyses (user_id, saved_at desc);

alter table public.analyses enable row level security;

-- Owners have full access to their own rows.
create policy "analyses_owner_select" on public.analyses
  for select using (auth.uid() = user_id);

create policy "analyses_owner_insert" on public.analyses
  for insert with check (auth.uid() = user_id);

create policy "analyses_owner_update" on public.analyses
  for update using (auth.uid() = user_id);

create policy "analyses_owner_delete" on public.analyses
  for delete using (auth.uid() = user_id);

-- Anyone (including anonymous) can read rows that were explicitly shared.
create policy "analyses_shared_select" on public.analyses
  for select using (share_id is not null);
