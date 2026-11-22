-- 006 — client feedback on review links.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run. Needs 005 first.
--
-- A client on a review link can leave, per shot: frame notes and drawings
-- (same shape as the team's review annotations), an overall comment, and
-- an Approve / Request changes call. It's feedback for the team to read —
-- nothing here changes a task's status.
--
-- Clients never touch the table directly. They go through two functions
-- that only work for a live (not revoked, not expired) link, and only for
-- the files on that link. One row per link + file + reviewer name, so a
-- client coming back carries on where they left off.

create table if not exists public.review_feedback (
  id            uuid primary key default gen_random_uuid(),
  token         text not null references public.review_links (token) on delete cascade,
  project_id    text not null,
  drive_file_id text not null,
  shot_code     text not null default '',
  task_type     text not null default '',
  version       jsonb,
  reviewer_name text not null check (length(reviewer_name) between 1 and 80),
  -- [{ id, frame, strokes: [{ color, points: [[x, y], …] }], note }]
  annotations   jsonb not null default '[]'::jsonb,
  comment       text not null default '',
  decision      text check (decision in ('approved', 'changes')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (token, drive_file_id, reviewer_name)
);

create index if not exists review_feedback_project on public.review_feedback (project_id, shot_code, task_type);

alter table public.review_feedback enable row level security;

-- The same people who manage links read the feedback and can clear it.
drop policy if exists review_feedback_select on public.review_feedback;
create policy review_feedback_select on public.review_feedback for select to authenticated
  using (public.can_manage_users());

drop policy if exists review_feedback_delete on public.review_feedback;
create policy review_feedback_delete on public.review_feedback for delete to authenticated
  using (public.can_manage_users());

-- The live link for a token, or null.
create or replace function public.live_review_link(p_token text)
returns public.review_links language sql stable security definer set search_path = public as $$
  select * from public.review_links
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());
$$;

revoke all on function public.live_review_link(text) from public, anon, authenticated;

-- What this reviewer already left on this link, so the page can reload it.
create or replace function public.get_review_feedback(p_token text, p_reviewer text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  link public.review_links;
begin
  link := public.live_review_link(p_token);
  if link.token is null then
    return null;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'driveFileId', f.drive_file_id,
      'annotations', f.annotations,
      'comment', f.comment,
      'decision', f.decision,
      'updatedAt', f.updated_at
    )), '[]'::jsonb)
    from public.review_feedback f
    where f.token = link.token and f.reviewer_name = btrim(p_reviewer)
  );
end;
$$;

revoke all on function public.get_review_feedback(text, text) from public;
grant execute on function public.get_review_feedback(text, text) to anon, authenticated;

-- Saves (replaces) this reviewer's feedback on one file of the link.
-- Returns true when saved, false when the link or file isn't valid.
create or replace function public.save_review_feedback(
  p_token text,
  p_drive_file_id text,
  p_reviewer text,
  p_annotations jsonb,
  p_comment text,
  p_decision text
)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  link public.review_links;
  item jsonb;
  reviewer text := btrim(coalesce(p_reviewer, ''));
begin
  link := public.live_review_link(p_token);
  if link.token is null then
    return false;
  end if;

  select i into item from jsonb_array_elements(link.items) as i
  where i ->> 'driveFileId' = p_drive_file_id
  limit 1;
  if item is null then
    return false;
  end if;

  if length(reviewer) < 1 or length(reviewer) > 80 then
    raise exception 'Please enter your name (up to 80 characters).';
  end if;
  if p_decision is not null and p_decision not in ('approved', 'changes') then
    raise exception 'Unknown decision.';
  end if;
  if jsonb_typeof(coalesce(p_annotations, '[]'::jsonb)) <> 'array'
     or pg_column_size(coalesce(p_annotations, '[]'::jsonb)) > 1000000 then
    raise exception 'Those notes are too large to save.';
  end if;
  if length(coalesce(p_comment, '')) > 10000 then
    raise exception 'That comment is too long (10,000 characters at most).';
  end if;

  insert into public.review_feedback as f (
    token, project_id, drive_file_id, shot_code, task_type, version,
    reviewer_name, annotations, comment, decision
  ) values (
    link.token, link.project_id, p_drive_file_id, coalesce(item ->> 'shotCode', ''),
    coalesce(item ->> 'taskType', ''), item -> 'version',
    reviewer, coalesce(p_annotations, '[]'::jsonb), coalesce(p_comment, ''), p_decision
  )
  on conflict (token, drive_file_id, reviewer_name) do update
  set annotations = excluded.annotations,
      comment     = excluded.comment,
      decision    = excluded.decision,
      updated_at  = now();

  return true;
end;
$$;

revoke all on function public.save_review_feedback(text, text, text, jsonb, text, text) from public;
grant execute on function public.save_review_feedback(text, text, text, jsonb, text, text) to anon, authenticated;
