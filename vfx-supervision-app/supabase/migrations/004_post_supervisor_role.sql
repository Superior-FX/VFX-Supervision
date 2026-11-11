-- 004 — adds the Post-Supervisor role.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- A Post-Supervisor has the same database rights as a Producer: reads
-- everything, changes shared records, manages people (never Admins) and
-- files delete requests. Like a Producer they can't Revise or Final, which
-- the app enforces in the UI.

alter table public.profiles drop constraint if exists profiles_roles_valid;
alter table public.profiles add constraint profiles_roles_valid check (
  roles <@ array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer', 'Post-Supervisor', 'Artist']
);

alter table public.invites drop constraint if exists invites_roles_valid;
alter table public.invites add constraint invites_roles_valid check (
  roles <@ array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer', 'Post-Supervisor', 'Artist']
);

-- Records, delete requests and the Team page all key off this helper.
create or replace function public.can_manage_users()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_roles() && array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer', 'Post-Supervisor'];
$$;
