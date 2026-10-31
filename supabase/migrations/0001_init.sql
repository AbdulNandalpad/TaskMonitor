-- Task Monitor: first schema. Idempotent enough to re-run on a fresh project (types, tables, functions,
-- policies and the storage bucket are all guarded). See docs/data-model.md and docs/build-spec.md section 4.


-- ---------------------------------------------------------------- enums
do $$ begin create type area_role as enum ('area_admin','manager','field_user','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type person_kind as enum ('employee','vendor_team'); exception when duplicate_object then null; end $$;
do $$ begin create type field_type as enum ('text','number','dropdown','yes_no','date','person','photo','section'); exception when duplicate_object then null; end $$;
do $$ begin create type task_status as enum ('not_started','in_progress','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type update_type as enum ('status','progress','voice','photo','note','edit','assignment'); exception when duplicate_object then null; end $$;
do $$ begin create type attachment_kind as enum ('photo','audio','document'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- hierarchy and access
create table if not exists organisation (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists plant (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references organisation, name text not null);
create table if not exists area (
  id uuid primary key default gen_random_uuid(), plant_id uuid not null references plant, code text unique not null,
  name text not null, wake_word text default 'Hey Monitor', settings jsonb not null default '{}', active boolean not null default true);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  login text unique not null,
  display_name text not null,
  phone text,
  language text not null default 'en-IN' check (language in ('en-IN','hi-IN','kn-IN')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists membership (
  user_id uuid not null references profiles on delete cascade,
  area_id uuid not null references area on delete cascade,
  role area_role not null,
  granted_by uuid references profiles,
  granted_at timestamptz not null default now(),
  primary key (user_id, area_id));
create index if not exists membership_area_role on membership (area_id, role);

-- ---------------------------------------------------------------- access helpers
create or replace function public.is_member(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a);
$$;
create or replace function public.has_role(a uuid, roles area_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a and m.role = any(roles));
$$;
create or replace function public.shares_area(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership a join membership b on a.area_id = b.area_id
                 where a.user_id = auth.uid() and b.user_id = u);
$$;

-- ---------------------------------------------------------------- workforce, forms
create table if not exists person (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  kind person_kind not null default 'employee', name text not null, role_title text,
  section_id uuid, phone text, vendor_name text, team_size int, employee_code text,
  user_id uuid references profiles, active boolean not null default true, created_at timestamptz not null default now());
create index if not exists person_area on person (area_id);

create table if not exists form (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  name text not null, template text, current_version_id uuid);
create table if not exists form_version (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  form_id uuid not null references form, version int not null,
  created_by uuid, created_at timestamptz not null default now(), note text, unique (form_id, version));
create table if not exists form_field (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  form_version_id uuid not null references form_version, key text not null, label text not null,
  type field_type not null, required boolean not null default false, options jsonb,
  position int not null, unique (form_version_id, key));

-- ---------------------------------------------------------------- task lists, sections, tasks
create table if not exists task_list (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area, form_id uuid references form,
  name text not null, starts_at timestamptz, ends_at timestamptz, planned_hours numeric,
  status text not null default 'planned', created_by uuid);
create table if not exists section (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_list_id uuid not null references task_list, name text not null,
  head_person_id uuid references person, position int not null default 0);
create table if not exists task (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_list_id uuid not null references task_list, seq int not null, external_ref text,
  section_id uuid references section, form_version_id uuid references form_version,
  current_version_id uuid, status task_status not null default 'not_started',
  progress smallint not null default 0 check (progress between 0 and 100),
  responsible_person_id uuid references person,
  created_by uuid, created_at timestamptz not null default now(), created_via text not null default 'app',
  unique (task_list_id, seq));
create index if not exists task_list_status on task (area_id, task_list_id, status);
create index if not exists task_resp on task (area_id, responsible_person_id);
create index if not exists task_section on task (area_id, section_id);

create table if not exists task_version (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_id uuid not null references task, version int not null, "values" jsonb not null,
  section_id uuid, responsible_person_id uuid, changed_by uuid, changed_at timestamptz not null default now(),
  source text not null, note text, unique (task_id, version));
create index if not exists task_version_task on task_version (task_id, version desc);
create index if not exists task_version_values on task_version using gin ("values");

create table if not exists task_field_change (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_id uuid not null references task, task_version_id uuid not null references task_version,
  field_key text not null, old_value jsonb, new_value jsonb, raw_input text,
  changed_by uuid, changed_at timestamptz not null default now());
create index if not exists task_field_change_task on task_field_change (task_id, changed_at desc);

create table if not exists task_update (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_id uuid not null references task, type update_type not null, by_user uuid,
  at timestamptz not null default now(), device_at timestamptz,
  status_before task_status, status_after task_status, progress_before smallint, progress_after smallint,
  text text, extracted jsonb, confirmed jsonb, task_version_id uuid);
create index if not exists task_update_task on task_update (task_id, at desc);

create table if not exists attachment (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area,
  task_update_id uuid not null references task_update, kind attachment_kind not null,
  object_key text not null, sha256 text not null, mime text, bytes bigint, width int, height int,
  duration_ms int, label text, thumb_key text, created_at timestamptz not null default now());
create index if not exists attachment_update on attachment (task_update_id);

create table if not exists import_job (
  id uuid primary key default gen_random_uuid(), area_id uuid not null references area, kind text not null,
  file_key text, sheet text, mapping jsonb, status text, rows_total int, rows_created int, rows_updated int,
  rows_skipped int, report jsonb, by_user uuid, created_at timestamptz not null default now(), finished_at timestamptz);

create table if not exists audit_log (
  id bigserial primary key, at timestamptz not null default now(), area_id uuid, user_id uuid,
  action text not null, target_type text, target_id uuid, detail jsonb, ip inet);
create index if not exists audit_area_at on audit_log (area_id, at desc);

-- current-version view: one row per task with its latest values. security_invoker keeps RLS in force.
create or replace view task_current with (security_invoker = true) as
  select t.id, t.area_id, t.task_list_id, t.seq, t.external_ref, t.section_id, t.status, t.progress,
         t.responsible_person_id, t.created_via, v.version, v."values", v.changed_by, v.changed_at, v.source
  from task t join task_version v on v.id = t.current_version_id;

-- ---------------------------------------------------------------- write functions
-- Versioning is enforced here, not in the app. Both functions are SECURITY DEFINER with an explicit role check
-- (Postgres grants cannot express "managers only" per area). p_actor is honoured only for service-role callers
-- (seed, admin tools), because EXECUTE is revoked from anon and public.
create or replace function public._actor(p_actor uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null then return auth.uid(); end if;
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then return p_actor; end if;
  raise exception 'not authenticated' using errcode = '42501';
end $$;

create or replace function public._require_role(a uuid, roles area_role[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;  -- service role (checked in _actor)
  if not has_role(a, roles) then raise exception 'not allowed in this area' using errcode = '42501'; end if;
end $$;

create or replace function public.task_create(
  p_list uuid, p_section uuid, p_values jsonb, p_responsible uuid,
  p_status task_status default 'not_started', p_progress smallint default 0,
  p_source text default 'app', p_external_ref text default null, p_actor uuid default null, p_note text default 'Created in app')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid := _actor(p_actor); v_area uuid; v_form_ver uuid; v_task uuid := gen_random_uuid(); v_ver uuid := gen_random_uuid(); v_seq int;
begin
  select tl.area_id, f.current_version_id into v_area, v_form_ver from task_list tl left join form f on f.id = tl.form_id where tl.id = p_list;
  if v_area is null then raise exception 'task list not found'; end if;
  perform _require_role(v_area, '{area_admin,manager}');
  select coalesce(max(seq), 0) + 1 into v_seq from task where task_list_id = p_list;
  insert into task(id, area_id, task_list_id, seq, external_ref, section_id, form_version_id, status, progress, responsible_person_id, created_by, created_via)
    values (v_task, v_area, p_list, v_seq, p_external_ref, p_section, v_form_ver, p_status, p_progress, p_responsible, v_actor, p_source);
  insert into task_version(id, area_id, task_id, version, "values", section_id, responsible_person_id, changed_by, changed_at, source, note)
    values (v_ver, v_area, v_task, 1, p_values, p_section, p_responsible, v_actor, now(), p_source, p_note);
  update task set current_version_id = v_ver where id = v_task;
  return v_task;
end $$;

create or replace function public.task_edit(
  p_task uuid, p_values jsonb, p_section uuid, p_responsible uuid, p_source text,
  p_actor uuid default null, p_raw jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := _actor(p_actor); v_area uuid; v_old task_version; v_new_id uuid := gen_random_uuid(); v_ver int; k text;
  v_changes jsonb := '[]'::jsonb; v_names jsonb;
begin
  select area_id into v_area from task where id = p_task;
  if v_area is null then raise exception 'task not found'; end if;
  perform _require_role(v_area, '{area_admin,manager}');
  select * into v_old from task_version where id = (select current_version_id from task where id = p_task);
  if v_old."values" = p_values and v_old.section_id is not distinct from p_section
     and v_old.responsible_person_id is not distinct from p_responsible then
    return null;  -- nothing changed, no new version
  end if;
  v_ver := v_old.version + 1;
  insert into task_version(id, area_id, task_id, version, "values", section_id, responsible_person_id, changed_by, changed_at, source)
    values (v_new_id, v_area, p_task, v_ver, p_values, p_section, p_responsible, v_actor, now(), p_source);
  for k in select jsonb_object_keys(p_values || v_old."values") loop
    if (v_old."values" -> k) is distinct from (p_values -> k) then
      insert into task_field_change(area_id, task_id, task_version_id, field_key, old_value, new_value, raw_input, changed_by, changed_at)
        values (v_area, p_task, v_new_id, k, v_old."values" -> k, p_values -> k, p_raw ->> k, v_actor, now());
    end if;
  end loop;
  if v_old.section_id is distinct from p_section then
    insert into task_field_change(area_id, task_id, task_version_id, field_key, old_value, new_value, changed_by, changed_at)
      values (v_area, p_task, v_new_id, 'section',
              to_jsonb((select name from section where id = v_old.section_id)), to_jsonb((select name from section where id = p_section)), v_actor, now());
  end if;
  if v_old.responsible_person_id is distinct from p_responsible then
    insert into task_field_change(area_id, task_id, task_version_id, field_key, old_value, new_value, changed_by, changed_at)
      values (v_area, p_task, v_new_id, 'responsible',
              to_jsonb((select name from person where id = v_old.responsible_person_id)), to_jsonb((select name from person where id = p_responsible)), v_actor, now());
  end if;
  update task set current_version_id = v_new_id, section_id = p_section, responsible_person_id = p_responsible where id = p_task;
  select coalesce(jsonb_agg(jsonb_build_array(field_key, old_value, new_value)), '[]') into v_changes from task_field_change where task_version_id = v_new_id;
  insert into task_update(area_id, task_id, type, by_user, at, text, extracted, task_version_id)
    values (v_area, p_task, case when p_source = 'assignment' then 'assignment'::update_type else 'edit'::update_type end, v_actor, now(),
            case when p_source = 'assignment' then 'Assigned' else 'Task edited' end || ' · version ' || v_ver, jsonb_build_object('changes', v_changes), v_new_id);
  return v_new_id;
end $$;

-- Status / progress / voice / photo / note updates by anyone who works the list (not viewers).
create or replace function public.task_record_update(
  p_task uuid, p_type update_type, p_status task_status default null, p_progress smallint default null,
  p_text text default null, p_extracted jsonb default null, p_confirmed jsonb default null, p_actor uuid default null, p_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid := _actor(p_actor); t task; v_id uuid := gen_random_uuid(); v_status task_status; v_prog smallint;
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
  insert into task_update(id, area_id, task_id, type, by_user, at, status_before, status_after, progress_before, progress_after, text, extracted, confirmed, task_version_id)
    values (v_id, t.area_id, p_task, p_type, v_actor, coalesce(p_at, now()), t.status, v_status, t.progress, v_prog, p_text, p_extracted, p_confirmed, t.current_version_id);
  if v_status is distinct from t.status or v_prog is distinct from t.progress then
    update task set status = v_status, progress = v_prog where id = p_task;
  end if;
  return v_id;
end $$;

-- Form builder save: new form_version with the full field set (key is stable across versions).
create or replace function public.form_save(p_form uuid, p_fields jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_area uuid; v_ver int; v_id uuid := gen_random_uuid(); f jsonb; i int := 0;
begin
  select area_id into v_area from form where id = p_form;
  if v_area is null then raise exception 'form not found'; end if;
  -- Form settings is open to every signed-in role for now (client agreed 31 Oct 2026); tighten here and in FORM_EDIT_ROLES.
  if auth.uid() is null or not is_member(v_area) then raise exception 'not allowed in this area' using errcode = '42501'; end if;
  select coalesce(max(version), 0) + 1 into v_ver from form_version where form_id = p_form;
  insert into form_version(id, area_id, form_id, version, created_by, note) values (v_id, v_area, p_form, v_ver, auth.uid(), p_note);
  for f in select * from jsonb_array_elements(p_fields) loop
    i := i + 1;
    insert into form_field(area_id, form_version_id, key, label, type, required, options, position)
      values (v_area, v_id, f ->> 'key', f ->> 'label', (f ->> 'type')::field_type, coalesce((f ->> 'required')::boolean, false), f -> 'options', i);
  end loop;
  update form set current_version_id = v_id where id = p_form;
  return v_id;
end $$;

revoke execute on function public._actor(uuid), public._require_role(uuid, area_role[]),
  public.task_create(uuid, uuid, jsonb, uuid, task_status, smallint, text, text, uuid, text),
  public.task_edit(uuid, jsonb, uuid, uuid, text, uuid, jsonb),
  public.task_record_update(uuid, update_type, task_status, smallint, text, jsonb, jsonb, uuid, timestamptz),
  public.form_save(uuid, jsonb, text) from public, anon;
grant execute on function public._actor(uuid), public._require_role(uuid, area_role[]),
  public.task_create(uuid, uuid, jsonb, uuid, task_status, smallint, text, text, uuid, text),
  public.task_edit(uuid, jsonb, uuid, uuid, text, uuid, jsonb),
  public.task_record_update(uuid, update_type, task_status, smallint, text, jsonb, jsonb, uuid, timestamptz),
  public.form_save(uuid, jsonb, text) to authenticated, service_role;

-- ---------------------------------------------------------------- row level security
do $$ declare t text; begin
  foreach t in array array['organisation','plant','area','profiles','membership','person','form','form_version','form_field',
    'task_list','section','task','task_version','task_field_change','task_update','attachment','import_job','audit_log'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- helper to (re)create a policy
create or replace function pg_temp.pol(tbl text, name text, cmd text, using_ text, check_ text default null) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on %I', name, tbl);
  execute format('create policy %I on %I for %s %s %s', name, tbl, cmd,
    case when using_ is null then '' else 'using (' || using_ || ')' end,
    case when check_ is null then '' else 'with check (' || check_ || ')' end);
end $$;

select pg_temp.pol('organisation', 'org_select', 'select', 'exists (select 1 from plant p join area a on a.plant_id = p.id where p.organisation_id = organisation.id and is_member(a.id))');
select pg_temp.pol('plant', 'plant_select', 'select', 'exists (select 1 from area a where a.plant_id = plant.id and is_member(a.id))');
select pg_temp.pol('area', 'area_select', 'select', 'is_member(id)');
select pg_temp.pol('profiles', 'profiles_select', 'select', 'id = auth.uid() or shares_area(id)');
select pg_temp.pol('profiles', 'profiles_update_own', 'update', 'id = auth.uid()', 'id = auth.uid()');
select pg_temp.pol('membership', 'membership_select', 'select', 'user_id = auth.uid() or has_role(area_id, ''{area_admin}'')');

select pg_temp.pol('person', 'person_select', 'select', 'is_member(area_id)');
select pg_temp.pol('person', 'person_insert', 'insert', null, 'has_role(area_id, ''{area_admin,manager}'')');
select pg_temp.pol('person', 'person_update', 'update', 'has_role(area_id, ''{area_admin,manager}'')', 'has_role(area_id, ''{area_admin,manager}'')');

select pg_temp.pol('form', 'form_select', 'select', 'is_member(area_id)');
select pg_temp.pol('form_version', 'form_version_select', 'select', 'is_member(area_id)');
select pg_temp.pol('form_field', 'form_field_select', 'select', 'is_member(area_id)');
-- form writes go through form_save()

select pg_temp.pol('task_list', 'task_list_select', 'select', 'is_member(area_id)');
select pg_temp.pol('task_list', 'task_list_write', 'all', 'has_role(area_id, ''{area_admin,manager}'')', 'has_role(area_id, ''{area_admin,manager}'')');
select pg_temp.pol('section', 'section_select', 'select', 'is_member(area_id)');
select pg_temp.pol('section', 'section_write', 'all', 'has_role(area_id, ''{area_admin,manager}'')', 'has_role(area_id, ''{area_admin,manager}'')');

select pg_temp.pol('task', 'task_select', 'select', 'is_member(area_id)');
select pg_temp.pol('task', 'task_write', 'insert', null, 'has_role(area_id, ''{area_admin,manager}'')');
select pg_temp.pol('task', 'task_update', 'update', 'has_role(area_id, ''{area_admin,manager,field_user}'')', 'has_role(area_id, ''{area_admin,manager,field_user}'')');
-- tasks are created with task_create() and edited with task_edit(); direct writes are limited by column grants below
revoke insert, delete on task from authenticated, anon;
revoke update on task from authenticated, anon;
grant update (status, progress) on task to authenticated;

select pg_temp.pol('task_version', 'task_version_select', 'select', 'is_member(area_id)');
select pg_temp.pol('task_field_change', 'task_field_change_select', 'select', 'is_member(area_id)');
revoke insert, update, delete on task_version, task_field_change, task_update from authenticated, anon;

select pg_temp.pol('task_update', 'task_update_select', 'select', 'is_member(area_id)');

select pg_temp.pol('attachment', 'attachment_select', 'select', 'is_member(area_id)');
select pg_temp.pol('attachment', 'attachment_insert', 'insert', null,
  'has_role(area_id, ''{area_admin,manager,field_user}'') and exists (select 1 from task_update u where u.id = task_update_id and u.area_id = attachment.area_id)');
revoke update, delete on attachment from authenticated, anon;

select pg_temp.pol('import_job', 'import_job_select', 'select', 'has_role(area_id, ''{area_admin,manager}'')');
select pg_temp.pol('import_job', 'import_job_insert', 'insert', null, 'has_role(area_id, ''{area_admin,manager}'')');
select pg_temp.pol('audit_log', 'audit_select', 'select', 'area_id is not null and has_role(area_id, ''{area_admin,manager}'')');
revoke insert, update, delete on audit_log from authenticated, anon;
revoke all on membership from anon; revoke insert, update, delete on membership from authenticated;
revoke insert, delete on profiles from authenticated, anon;
revoke insert, update, delete on organisation, plant, area, form, form_version, form_field from authenticated, anon;

-- ---------------------------------------------------------------- storage: private "attachments" bucket
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict (id) do nothing;

create or replace function public.storage_area(obj_name text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  if split_part(obj_name, '/', 1) <> 'area' then return null; end if;
  return split_part(obj_name, '/', 2)::uuid;
exception when others then return null;
end $$;

drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_member(public.storage_area(name)));
drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.has_role(public.storage_area(name), '{area_admin,manager,field_user}'));
-- no update or delete policies: attachments are kept (retention_days = 90 minimum, nothing is deleted automatically)
