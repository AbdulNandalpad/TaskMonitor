-- 0008 · Furnace Analysis (converter lining scans). Needs 0007. Safe to run twice.
-- A vendor report PDF per heat is uploaded, its 23-zone table is read and confirmed, then every zone is judged against
-- limits that an administrator maintains (versioned, with recommendations). Nothing here touches Task Monitor.

do $$ begin create type fa_role_t as enum ('admin', 'analyst', 'viewer'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- who can do what inside the app
-- Having the app (migration 0007) means read access. analyst: upload and save scans. admin: also limits, recipients, converters.
-- Platform administrators count as Furnace Analysis administrators.
create table if not exists fa_role (
  user_id uuid primary key references profiles on delete cascade,
  role fa_role_t not null);

create or replace function public.fa_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select has_app('furnace_analysis') and (is_platform_admin() or exists (select 1 from fa_role r where r.user_id = auth.uid() and r.role = 'admin'));
$$;
create or replace function public.fa_can_edit() returns boolean
language sql stable security definer set search_path = public as $$
  select has_app('furnace_analysis') and (is_platform_admin() or exists (select 1 from fa_role r where r.user_id = auth.uid() and r.role in ('admin', 'analyst')));
$$;

-- ---------------------------------------------------------------- converters, campaigns, scans, readings
create table if not exists fa_converter (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  plant text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists fa_campaign (
  id uuid primary key default gen_random_uuid(),
  converter_id uuid not null references fa_converter on delete cascade,
  no int not null,
  started_on date,
  ended_on date,
  unique (converter_id, no));

-- one row per uploaded report (one heat)
create table if not exists fa_scan (
  id uuid primary key default gen_random_uuid(),
  converter_id uuid not null references fa_converter on delete cascade,
  campaign_id uuid not null references fa_campaign on delete cascade,
  heat text not null,
  meas_no int not null,
  scanned_at timestamptz not null,
  steel_level_m numeric,
  steel_tonnes numeric,
  bath_level_m numeric,
  pdf_key text not null,
  pdf_bytes int,
  limit_version_id uuid,
  uploaded_by uuid references profiles,
  uploaded_at timestamptz not null default now(),
  unique (campaign_id, meas_no));
create index if not exists fa_scan_conv_time on fa_scan (converter_id, scanned_at desc);

create table if not exists fa_reading (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references fa_scan on delete cascade,
  zone text not null,
  section text not null,
  avg_mm numeric not null,
  min_mm numeric not null,
  angle text,
  depth text,
  status text not null default 'unset' check (status in ('ok', 'warning', 'critical', 'unset')),
  unique (scan_id, zone));

-- ---------------------------------------------------------------- limits (versioned) and recommendations
create table if not exists fa_limit_version (
  id uuid primary key default gen_random_uuid(),
  converter_id uuid not null references fa_converter on delete cascade,
  version int not null,
  note text,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  unique (converter_id, version));

-- zone = an exact zone name, a section name, or '*' for every zone. The most specific row wins.
-- Thickness BELOW the warning level is a warning, below the critical level is critical.
create table if not exists fa_limit (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references fa_limit_version on delete cascade,
  zone text not null default '*',
  metric text not null check (metric in ('avg', 'min')),
  warn_below numeric,
  critical_below numeric,
  rec_warning text,
  rec_critical text,
  unique (version_id, zone, metric));

-- who receives the emails
create table if not exists fa_recipient (
  id uuid primary key default gen_random_uuid(),
  converter_id uuid references fa_converter on delete cascade,
  name text not null default '',
  email text not null,
  min_severity text not null default 'warning' check (min_severity in ('warning', 'critical')),
  active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists fa_notification (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references fa_scan on delete cascade,
  email text not null,
  outcome text not null,
  detail text,
  at timestamptz not null default now());

-- ---------------------------------------------------------------- rules
do $$ declare t text; begin
  foreach t in array array['fa_role','fa_converter','fa_campaign','fa_scan','fa_reading','fa_limit_version','fa_limit','fa_recipient','fa_notification'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke insert, update, delete on %I from authenticated', t);
  end loop;
end $$;

drop policy if exists fa_role_select on fa_role;
create policy fa_role_select on fa_role for select to authenticated using (user_id = auth.uid() or fa_is_admin());
do $$ declare t text; begin
  foreach t in array array['fa_converter','fa_campaign','fa_scan','fa_reading','fa_limit_version','fa_limit'] loop
    execute format('create policy %I on %I for select to authenticated using (has_app(''furnace_analysis''))', t || '_select', t);
  end loop;
end $$;
-- recipients' addresses and the send log are for administrators
create policy fa_recipient_select on fa_recipient for select to authenticated using (fa_is_admin());
create policy fa_notification_select on fa_notification for select to authenticated using (fa_is_admin());

-- ---------------------------------------------------------------- storage: private bucket for the vendor PDFs
insert into storage.buckets (id, name, public) values ('fa-reports', 'fa-reports', false) on conflict (id) do nothing;
drop policy if exists fa_reports_read on storage.objects;
create policy fa_reports_read on storage.objects for select to authenticated using (bucket_id = 'fa-reports' and public.has_app('furnace_analysis'));
drop policy if exists fa_reports_insert on storage.objects;
create policy fa_reports_insert on storage.objects for insert to authenticated with check (bucket_id = 'fa-reports' and public.fa_can_edit());

-- ---------------------------------------------------------------- functions
-- Save one confirmed scan with its readings. Converter and campaign are created on first sight. The caller sends the
-- readings with the status already judged against the limit version it names.
create or replace function public.fa_scan_save(p_scan jsonb, p_readings jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_camp uuid; v_scan uuid; r jsonb;
begin
  if auth.uid() is null or not fa_can_edit() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into fa_converter (code, name, plant)
    values (p_scan->>'converter_code', coalesce(nullif(p_scan->>'converter_name', ''), 'Converter ' || (p_scan->>'converter_code')), coalesce(p_scan->>'plant', ''))
    on conflict (code) do nothing;
  select id into v_conv from fa_converter where code = p_scan->>'converter_code';
  insert into fa_campaign (converter_id, no) values (v_conv, (p_scan->>'campaign_no')::int) on conflict (converter_id, no) do nothing;
  select id into v_camp from fa_campaign where converter_id = v_conv and no = (p_scan->>'campaign_no')::int;
  if exists (select 1 from fa_scan where campaign_id = v_camp and meas_no = (p_scan->>'meas_no')::int) then
    raise exception 'this measurement is already saved' using errcode = '23505';
  end if;
  insert into fa_scan (converter_id, campaign_id, heat, meas_no, scanned_at, steel_level_m, steel_tonnes, bath_level_m, pdf_key, pdf_bytes, limit_version_id, uploaded_by)
    values (v_conv, v_camp, p_scan->>'heat', (p_scan->>'meas_no')::int, (p_scan->>'scanned_at')::timestamptz,
            nullif(p_scan->>'steel_level_m', '')::numeric, nullif(p_scan->>'steel_tonnes', '')::numeric, nullif(p_scan->>'bath_level_m', '')::numeric,
            p_scan->>'pdf_key', nullif(p_scan->>'pdf_bytes', '')::int, nullif(p_scan->>'limit_version_id', '')::uuid, auth.uid())
    returning id into v_scan;
  for r in select * from jsonb_array_elements(p_readings) loop
    insert into fa_reading (scan_id, zone, section, avg_mm, min_mm, angle, depth, status)
      values (v_scan, r->>'zone', r->>'section', (r->>'avg_mm')::numeric, (r->>'min_mm')::numeric, r->>'angle', r->>'depth', coalesce(r->>'status', 'unset'));
  end loop;
  insert into audit_log (user_id, action, target_type, target_id, detail)
    values (auth.uid(), 'fa_scan_saved', 'fa_scan', v_scan, jsonb_build_object('heat', p_scan->>'heat', 'meas_no', p_scan->>'meas_no'));
  return v_scan;
end $$;

-- Replace the limits of a converter by a new version (the old one stays for the scans that used it). Administrators only.
create or replace function public.fa_limits_save(p_converter uuid, p_note text, p_rows jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ver int; v_id uuid; r jsonb;
begin
  if auth.uid() is null or not fa_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from fa_converter where id = p_converter) then raise exception 'no such converter' using errcode = '22023'; end if;
  select coalesce(max(version), 0) + 1 into v_ver from fa_limit_version where converter_id = p_converter;
  update fa_limit_version set active = false where converter_id = p_converter;
  insert into fa_limit_version (converter_id, version, note, created_by) values (p_converter, v_ver, p_note, auth.uid()) returning id into v_id;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into fa_limit (version_id, zone, metric, warn_below, critical_below, rec_warning, rec_critical)
      values (v_id, coalesce(nullif(trim(r->>'zone'), ''), '*'), r->>'metric', nullif(r->>'warn_below', '')::numeric, nullif(r->>'critical_below', '')::numeric,
              nullif(r->>'rec_warning', ''), nullif(r->>'rec_critical', ''))
      on conflict (version_id, zone, metric) do update set warn_below = excluded.warn_below, critical_below = excluded.critical_below,
        rec_warning = excluded.rec_warning, rec_critical = excluded.rec_critical;
  end loop;
  insert into audit_log (user_id, action, target_type, target_id, detail)
    values (auth.uid(), 'fa_limits_saved', 'fa_converter', p_converter, jsonb_build_object('version', v_ver));
  return v_id;
end $$;

create or replace function public.fa_recipient_save(p_id uuid, p_converter uuid, p_name text, p_email text, p_min text, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not fa_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'not a valid email address' using errcode = '22023'; end if;
  if p_id is null then
    insert into fa_recipient (converter_id, name, email, min_severity, active) values (p_converter, coalesce(p_name, ''), lower(trim(p_email)), p_min, coalesce(p_active, true)) returning id into v_id;
  else
    update fa_recipient set converter_id = p_converter, name = coalesce(p_name, ''), email = lower(trim(p_email)), min_severity = p_min, active = coalesce(p_active, true) where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.fa_recipient_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not fa_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from fa_recipient where id = p_id;
end $$;

-- the send log is written by the server with the signed-in analyst's session
create or replace function public.fa_notification_log(p_scan uuid, p_email text, p_outcome text, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not fa_can_edit() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into fa_notification (scan_id, email, outcome, detail) values (p_scan, p_email, p_outcome, left(p_detail, 300));
end $$;

-- recipients to mail for a scan (analysts need the addresses to send, but cannot read the table)
create or replace function public.fa_recipients_for(p_converter uuid, p_severity text) returns table (name text, email text)
language sql stable security definer set search_path = public as $$
  select r.name, r.email from fa_recipient r
  where fa_can_edit() and r.active and (r.converter_id is null or r.converter_id = p_converter)
    and (r.min_severity = 'warning' or p_severity = 'critical');
$$;

do $$ declare f text; begin
  foreach f in array array[
    'fa_is_admin()','fa_can_edit()','fa_scan_save(jsonb,jsonb)','fa_limits_save(uuid,text,jsonb)',
    'fa_recipient_save(uuid,uuid,text,text,text,boolean)','fa_recipient_delete(uuid)','fa_notification_log(uuid,text,text,text)','fa_recipients_for(uuid,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- the platform admin sets Furnace Analysis roles for others
create or replace function public.fa_role_set(p_login text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if auth.uid() is null or not fa_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into v_user from profiles where login = lower(trim(p_login)) and active;
  if v_user is null then raise exception 'no such user' using errcode = '22023'; end if;
  if p_role is null or p_role = 'none' then delete from fa_role where user_id = v_user;
  else insert into fa_role (user_id, role) values (v_user, p_role::fa_role_t) on conflict (user_id) do update set role = excluded.role; end if;
end $$;
revoke execute on function public.fa_role_set(text, text) from public, anon;
grant execute on function public.fa_role_set(text, text) to authenticated, service_role;

-- create or rename a converter (so limits can be set before the first scan arrives). Administrators only.
create or replace function public.fa_converter_save(p_code text, p_name text, p_plant text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not fa_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(trim(p_code), '') = '' or coalesce(trim(p_name), '') = '' then raise exception 'code and name are required' using errcode = '22023'; end if;
  insert into fa_converter (code, name, plant) values (trim(p_code), trim(p_name), coalesce(trim(p_plant), ''))
    on conflict (code) do update set name = excluded.name, plant = excluded.plant returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.fa_converter_save(text, text, text) from public, anon;
grant execute on function public.fa_converter_save(text, text, text) to authenticated, service_role;
