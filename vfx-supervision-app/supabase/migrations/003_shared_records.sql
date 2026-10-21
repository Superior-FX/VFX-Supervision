-- 003 — shared project data.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Everything that used to live in each browser's localStorage — projects,
-- the artist roster, and each project's shots (tasks included), scenes,
-- capture reports and script reports — lives here, one row per item, so
-- the whole team works on the same data and sees changes live.
--   collection 'projects' / 'artists'        project_id = ''
--   'post-reports' (shots), 'scenes',
--   'capture-reports', 'script-reports'      project_id = the project's id
-- position keeps each list in the order the app had it.

create table if not exists public.records (
  collection text not null check (
    collection in ('projects', 'artists', 'post-reports', 'scenes', 'capture-reports', 'script-reports')
  ),
  project_id text not null default '',
  id         text not null,
  position   integer not null default 0,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (collection, project_id, id)
);

-- Deletes reach other open apps with the full row, so they know what went.
alter table public.records replica identity full;

create or replace function public.touch_record()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists touch_record on public.records;
create trigger touch_record
  before update on public.records
  for each row execute function public.touch_record();

alter table public.records enable row level security;

-- Anyone with a role reads everything.
drop policy if exists records_select on public.records;
create policy records_select on public.records for select to authenticated
  using (cardinality(public.my_roles()) > 0);

-- Supervisors, producers and Admins change anything. Artists only change
-- shots (starting, submitting and versioning their tasks live in them).
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated
  with check (
    public.can_manage_users()
    or (collection = 'post-reports' and 'Artist' = any (public.my_roles()))
  );

drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (
    public.can_manage_users()
    or (collection = 'post-reports' and 'Artist' = any (public.my_roles()))
  )
  with check (
    public.can_manage_users()
    or (collection = 'post-reports' and 'Artist' = any (public.my_roles()))
  );

drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete to authenticated
  using (public.can_manage_users());

-- Live updates.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception
  when duplicate_object then null;
end;
$$;
