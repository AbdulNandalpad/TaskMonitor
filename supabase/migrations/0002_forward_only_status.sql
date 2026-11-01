-- CR-3: task status moves forward only (not_started -> in_progress -> completed), completed is final, and progress
-- never goes below its current value. task_record_update() is the only write path (the browser role has no direct
-- grants on task status/progress changes beyond it), so the API and the voice path inherit the rule.
-- Idempotent: create or replace of one function, same signature as in 0001 (grants are kept). Paste-able in the SQL editor.

create or replace function public.task_record_update(
  p_task uuid, p_type update_type, p_status task_status default null, p_progress smallint default null,
  p_text text default null, p_extracted jsonb default null, p_confirmed jsonb default null, p_actor uuid default null, p_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := _actor(p_actor); t task; v_id uuid := gen_random_uuid(); v_status task_status; v_prog smallint;
  v_rank_old int; v_rank_new int;
begin
  select * into t from task where id = p_task;
  if t.id is null then raise exception 'task not found'; end if;
  perform _require_role(t.area_id, '{area_admin,manager,field_user}');
  v_status := coalesce(p_status, t.status);
  v_prog := coalesce(p_progress, t.progress);
  if p_status is not null and p_progress is null then
    v_prog := case p_status when 'completed' then 100 when 'not_started' then 0 else case when t.progress in (0,100) then 10 else t.progress end end;
  end if;
  if p_progress is not null and p_status is null then
    v_status := case when p_progress = 100 then 'completed' when p_progress = 0 then 'not_started' else 'in_progress' end;
  end if;
  if v_status = 'completed' then v_prog := 100; elsif v_status = 'not_started' then v_prog := 0; end if;

  -- forward-only rule (a note or remark passes no status/progress, so it never trips this)
  if p_status is not null or p_progress is not null then
    v_rank_old := case t.status when 'not_started' then 0 when 'in_progress' then 1 else 2 end;
    v_rank_new := case v_status when 'not_started' then 0 when 'in_progress' then 1 else 2 end;
    if v_rank_new < v_rank_old then
      raise exception 'status cannot go back' using errcode = '22023';
    end if;
    if v_prog < t.progress then
      raise exception 'progress cannot go down' using errcode = '22023';
    end if;
  end if;

  insert into task_update(id, area_id, task_id, type, by_user, at, status_before, status_after, progress_before, progress_after, text, extracted, confirmed, task_version_id)
    values (v_id, t.area_id, p_task, p_type, v_actor, coalesce(p_at, now()), t.status, v_status, t.progress, v_prog, p_text, p_extracted, p_confirmed, t.current_version_id);
  if v_status is distinct from t.status or v_prog is distinct from t.progress then
    update task set status = v_status, progress = v_prog where id = p_task;
  end if;
  return v_id;
end $$;
