-- 001 — accounts, invites and roles.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Roles are enforced here (row-level security + triggers), not just hidden in
-- the UI. A person can hold several roles. Signing up with no invite gives a
-- profile with no roles, which the app shows as "waiting for access".

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null default '',
  roles      text[] not null default '{}',
  artist_id  text,               -- links to the artist roster (Post Reports → Artists)
  created_at timestamptz not null default now(),
  constraint profiles_roles_valid check (
    roles <@ array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer', 'Artist']
  )
);

create table if not exists public.invites (
  email      text primary key check (email = lower(email)),
  name       text not null default '',
  roles      text[] not null default '{}',
  artist_id  text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invites_roles_valid check (
    roles <@ array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer', 'Artist']
  )
);

-- ── Role helpers ──────────────────────────────────────────────────────────
-- security definer so policies on profiles can call them without recursing
-- into their own RLS.

create or replace function public.my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select roles from public.profiles where id = auth.uid()), '{}');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select 'Admin' = any (public.my_roles());
$$;

-- Admin, both supervisors and Producer can manage people (Admins excepted).
create or replace function public.can_manage_users()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_roles() && array['Admin', 'VFX Supervisor', 'Comp Supervisor', 'Producer'];
$$;

-- ── New sign-ups pick up their invite ─────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites where email = lower(new.email);

  insert into public.profiles (id, email, name, roles, artist_id)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(inv.name, ''), new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(inv.roles, '{}'),
    inv.artist_id
  );

  if inv.email is not null then
    delete from public.invites where email = inv.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Who may change what on a profile ──────────────────────────────────────
-- auth.uid() is null when run from the SQL editor, so the dashboard can
-- always repair accounts by hand.

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id <> old.id or new.email <> old.email then
    raise exception 'A profile''s id and email can''t be changed here.';
  end if;

  -- Only Admins touch Admin accounts, or hand out / take away Admin.
  if not public.is_admin()
     and ('Admin' = any (old.roles) or 'Admin' = any (new.roles))
     and (old.id <> auth.uid() or new.roles is distinct from old.roles) then
    raise exception 'Only an Admin can grant, remove or edit Admin accounts.';
  end if;

  if (new.roles is distinct from old.roles or new.artist_id is distinct from old.artist_id)
     and not public.can_manage_users() then
    raise exception 'You don''t have permission to change roles or artist links.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ── Row-level security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.invites  enable row level security;

-- Everyone sees their own profile (so a pending user sees "waiting");
-- anyone with a role sees the whole team, for names and assignments.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or cardinality(public.my_roles()) > 0);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.can_manage_users())
  with check (id = auth.uid() or public.can_manage_users());

-- Profiles are created by the sign-up trigger and removed with the auth user;
-- "remove access" in the app clears roles instead of deleting.

drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated
  using (public.can_manage_users());

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert to authenticated
  with check (public.can_manage_users() and (public.is_admin() or not 'Admin' = any (roles)));

drop policy if exists invites_update on public.invites;
create policy invites_update on public.invites for update to authenticated
  using (public.can_manage_users() and (public.is_admin() or not 'Admin' = any (roles)))
  with check (public.can_manage_users() and (public.is_admin() or not 'Admin' = any (roles)));

drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated
  using (public.can_manage_users() and (public.is_admin() or not 'Admin' = any (roles)));

-- ── Bootstrap: the first Admin ────────────────────────────────────────────
-- Whoever signs up with this email becomes Admin. Change it before running if
-- you'll sign in with a different address.

insert into public.invites (email, name, roles)
values ('will@superior-fx.com', 'Will Cox', '{Admin}')
on conflict (email) do nothing;
