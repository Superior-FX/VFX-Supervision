-- 002 — delete requests.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Anyone who isn't an Admin can't delete a project, scene, shot or task
-- outright: their typed DELETE files a request here, and an Admin approves
-- (the app then deletes it, folder moves included) or declines it.

create table if not exists public.delete_requests (
  id                uuid primary key default gen_random_uuid(),
  project_id        text not null,
  kind              text not null check (kind in ('project', 'scene', 'shot', 'task')),
  target_id         text not null,
  parent_id         text,                    -- a task's shot id
  label             text not null default '', -- e.g. "GOTP_010_0040 — Comp"
  requested_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  requested_by_name text not null default '',
  created_at        timestamptz not null default now(),
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by        uuid references auth.users (id) on delete set null,
  decided_at        timestamptz
);

-- One open request per thing.
create unique index if not exists delete_requests_one_pending
  on public.delete_requests (kind, target_id) where status = 'pending';

-- Only an Admin may approve or decline; the requester may only cancel their
-- own pending request. Nothing else about a request changes after filing.
create or replace function public.guard_delete_request_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'This request has already been decided.';
  end if;
  if (new.project_id, new.kind, new.target_id, new.parent_id, new.label, new.requested_by, new.requested_by_name, new.created_at)
     is distinct from
     (old.project_id, old.kind, old.target_id, old.parent_id, old.label, old.requested_by, old.requested_by_name, old.created_at) then
    raise exception 'Only a request''s status can change.';
  end if;
  if new.status in ('approved', 'declined') then
    if not public.is_admin() then
      raise exception 'Only an Admin can approve or decline a delete request.';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
  elsif new.status = 'cancelled' then
    if old.requested_by <> auth.uid() and not public.is_admin() then
      raise exception 'Only the person who asked can cancel this request.';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists guard_delete_request_update on public.delete_requests;
create trigger guard_delete_request_update
  before update on public.delete_requests
  for each row execute function public.guard_delete_request_update();

alter table public.delete_requests enable row level security;

-- Everyone on the team can see requests (so items show "Delete requested").
drop policy if exists delete_requests_select on public.delete_requests;
create policy delete_requests_select on public.delete_requests for select to authenticated
  using (cardinality(public.my_roles()) > 0);

-- Supervisors and producers file requests, as themselves, as pending.
drop policy if exists delete_requests_insert on public.delete_requests;
create policy delete_requests_insert on public.delete_requests for insert to authenticated
  with check (public.can_manage_users() and requested_by = auth.uid() and status = 'pending');

drop policy if exists delete_requests_update on public.delete_requests;
create policy delete_requests_update on public.delete_requests for update to authenticated
  using (public.is_admin() or requested_by = auth.uid())
  with check (public.is_admin() or requested_by = auth.uid());
