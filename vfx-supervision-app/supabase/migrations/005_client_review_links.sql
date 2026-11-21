-- 005 — client review links.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- A review link is a random token that lets someone with no account watch a
-- hand-picked set of review proxies. The proxies themselves stay in Google
-- Drive (shared "anyone with the link" by the app when the link is made);
-- this table only says which Drive files belong to which link.
--
-- The team reads and manages links through normal row-level security.
-- Clients never touch the table: they call get_review_link(token), which
-- only answers for a link that hasn't been revoked or expired, and only
-- with what the client page needs.

create table if not exists public.review_links (
  token       text primary key check (length(token) >= 24),
  project_id  text not null,
  title       text not null default '',
  client_name text not null default '',
  -- [{ shotCode, taskType, version, fileName, driveFileId, permissionId }]
  items       jsonb not null default '[]'::jsonb,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,           -- null = never expires
  revoked_at  timestamptz,
  view_count  integer not null default 0,
  last_viewed_at timestamptz
);

create index if not exists review_links_project on public.review_links (project_id, created_at desc);

alter table public.review_links enable row level security;

-- Supervisors, producers, Post-Supervisors and Admins see and manage links.
-- Artists don't.
drop policy if exists review_links_select on public.review_links;
create policy review_links_select on public.review_links for select to authenticated
  using (public.can_manage_users());

drop policy if exists review_links_insert on public.review_links;
create policy review_links_insert on public.review_links for insert to authenticated
  with check (public.can_manage_users());

drop policy if exists review_links_update on public.review_links;
create policy review_links_update on public.review_links for update to authenticated
  using (public.can_manage_users())
  with check (public.can_manage_users());

drop policy if exists review_links_delete on public.review_links;
create policy review_links_delete on public.review_links for delete to authenticated
  using (public.can_manage_users());

-- What the client page loads. Returns null for an unknown, revoked or
-- expired token, so the page can't tell those apart (no probing). Counts
-- the view while it's at it.
create or replace function public.get_review_link(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  link public.review_links;
begin
  select * into link from public.review_links
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());
  if link.token is null then
    return null;
  end if;

  update public.review_links
  set view_count = view_count + 1, last_viewed_at = now()
  where token = link.token;

  return jsonb_build_object(
    'title', link.title,
    'client_name', link.client_name,
    'expires_at', link.expires_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'shotCode', i ->> 'shotCode',
        'taskType', i ->> 'taskType',
        'version', i -> 'version',
        'driveFileId', i ->> 'driveFileId'
      )), '[]'::jsonb)
      from jsonb_array_elements(link.items) as i
    )
  );
end;
$$;

revoke all on function public.get_review_link(text) from public;
grant execute on function public.get_review_link(text) to anon, authenticated;
