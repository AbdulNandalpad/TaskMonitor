-- CR-7: cached AI work summaries for the detailed report. One row per task, keyed by an evidence hash: the summary is
-- regenerated only when the evidence changes, so the report is fast and repeatable.
-- Members of the area can read; writes only through task_summary_save() (managers and area admins), no direct grants.
-- Idempotent; paste-able in the SQL editor after 0001-0004.

create table if not exists task_summary (
  task_id uuid primary key references task on delete cascade,
  area_id uuid not null references area,
  generated_at timestamptz not null default now(),
  evidence_hash text not null,
  text text not null,
  model text not null
);
create index if not exists task_summary_area on task_summary (area_id);

alter table task_summary enable row level security;
drop policy if exists task_summary_select on task_summary;
create policy task_summary_select on task_summary for select using (is_member(area_id));
revoke insert, update, delete on task_summary from authenticated, anon;

create or replace function public.task_summary_save(p_task uuid, p_hash text, p_text text, p_model text)
returns void language plpgsql security definer set search_path = public as $$
declare v_area uuid;
begin
  select area_id into v_area from task where id = p_task;
  if v_area is null then raise exception 'task not found' using errcode = '22023'; end if;
  if auth.uid() is null or not has_role(v_area, '{area_admin,manager}') then
    raise exception 'not allowed in this area' using errcode = '42501';
  end if;
  if btrim(coalesce(p_text, '')) = '' then raise exception 'summary is empty' using errcode = '22023'; end if;
  insert into task_summary(task_id, area_id, generated_at, evidence_hash, text, model)
    values (p_task, v_area, now(), p_hash, p_text, p_model)
  on conflict (task_id) do update
    set generated_at = now(), evidence_hash = excluded.evidence_hash, text = excluded.text, model = excluded.model;
end $$;

revoke execute on function public.task_summary_save(uuid, text, text, text) from public, anon;
grant execute on function public.task_summary_save(uuid, text, text, text) to authenticated;
