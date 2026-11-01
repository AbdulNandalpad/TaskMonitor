-- CR-6: names and labels are editable in the app, and every change is recorded.
-- Task list (name, dates, planned hours), section (name, head), person (name, role, phone, team size ...) by managers and
-- area admins; area (name) by area admins only. Writes are limited to those columns with column-level grants (as for task),
-- and an AFTER UPDATE trigger writes one audit_log row per changed column: detail = {"field","old","new"}.
-- Nothing is deleted: delete rights on these tables are removed. Idempotent; paste-able in the SQL editor after 0001-0003.

-- ---------------------------------------------------------------- audit trigger
create or replace function public.audit_column_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text := tg_argv[0]; v_area uuid; v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new); i int;
begin
  v_area := case when tg_table_name = 'area' then new.id else (v_new ->> 'area_id')::uuid end;
  for i in 1 .. coalesce(array_length(tg_argv, 1), 0) - 1 loop
    if (v_old -> tg_argv[i]) is distinct from (v_new -> tg_argv[i]) then
      insert into audit_log(area_id, user_id, action, target_type, target_id, detail)
        values (v_area, auth.uid(), v_action, tg_table_name, (v_new ->> 'id')::uuid,
                jsonb_build_object('field', tg_argv[i], 'old', v_old -> tg_argv[i], 'new', v_new -> tg_argv[i]));
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists audit_task_list on task_list;
create trigger audit_task_list after update on task_list for each row
  execute function public.audit_column_changes('task_list_renamed', 'name', 'starts_at', 'ends_at', 'planned_hours');
drop trigger if exists audit_section on section;
create trigger audit_section after update on section for each row
  execute function public.audit_column_changes('section_renamed', 'name', 'head_person_id');
drop trigger if exists audit_person on person;
create trigger audit_person after update on person for each row
  execute function public.audit_column_changes('person_edited', 'name', 'role_title', 'phone', 'team_size', 'section_id', 'vendor_name', 'kind');
drop trigger if exists audit_area on area;
create trigger audit_area after update on area for each row
  execute function public.audit_column_changes('area_renamed', 'name');

-- ---------------------------------------------------------------- column-level update rights
revoke update on task_list, section, person, area from authenticated, anon;
revoke delete on task_list, section, person from authenticated, anon;
grant update (name, starts_at, ends_at, planned_hours) on task_list to authenticated;
grant update (name, head_person_id) on section to authenticated;
-- person: the workforce import also sets section, vendor and kind, so those columns are granted too
grant update (name, role_title, phone, team_size, section_id, vendor_name, kind) on person to authenticated;
grant update (name) on area to authenticated;

-- ---------------------------------------------------------------- row policies (who may update)
drop policy if exists task_list_write on task_list;
drop policy if exists task_list_insert on task_list;
create policy task_list_insert on task_list for insert with check (has_role(area_id, '{area_admin,manager}'));
drop policy if exists task_list_update on task_list;
create policy task_list_update on task_list for update using (has_role(area_id, '{area_admin,manager}')) with check (has_role(area_id, '{area_admin,manager}'));

drop policy if exists section_write on section;
drop policy if exists section_insert on section;
create policy section_insert on section for insert with check (has_role(area_id, '{area_admin,manager}'));
drop policy if exists section_update on section;
create policy section_update on section for update using (has_role(area_id, '{area_admin,manager}')) with check (has_role(area_id, '{area_admin,manager}'));

-- person_insert / person_update already exist from 0001 for {area_admin,manager}

drop policy if exists area_update on area;
create policy area_update on area for update using (has_role(id, '{area_admin}')) with check (has_role(id, '{area_admin}'));
