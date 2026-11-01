-- CR-5: a recorded remark (type note or voice) can be corrected by its author or a manager / area admin.
-- The corrected text replaces what is shown; the original is kept in text_original (first edit only) and the entry is
-- marked as edited. Nothing is deleted. task_update stays otherwise immutable: the browser role has no update right on it,
-- the only write path is task_update_correct(). Idempotent; paste-able in the SQL editor after 0001 and 0002.

alter table task_update
  add column if not exists text_original text,
  add column if not exists edited_by uuid,
  add column if not exists edited_at timestamptz,
  add column if not exists edit_count int not null default 0;

create or replace function public.task_update_correct(p_update uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare u task_update; v_text text := btrim(coalesce(p_text, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into u from task_update where id = p_update;
  if u.id is null then raise exception 'entry not found' using errcode = '22023'; end if;
  if u.type not in ('note', 'voice') then
    raise exception 'only notes and voice remarks can be corrected' using errcode = '22023';
  end if;
  -- the author (if they may still work the task) or a manager / area admin; viewers never
  if not (has_role(u.area_id, '{area_admin,manager}')
          or (u.by_user = auth.uid() and has_role(u.area_id, '{field_user}'))) then
    raise exception 'not allowed to correct this entry' using errcode = '42501';
  end if;
  if v_text = '' then raise exception 'Type a remark first.' using errcode = '22023'; end if;
  if v_text = coalesce(u.text, '') then return; end if;  -- nothing changed
  update task_update set
    text_original = case when u.edit_count = 0 then u.text else u.text_original end,
    text = v_text, edited_by = auth.uid(), edited_at = now(), edit_count = u.edit_count + 1
  where id = p_update;
end $$;

revoke execute on function public.task_update_correct(uuid, text) from public, anon;
grant execute on function public.task_update_correct(uuid, text) to authenticated;
