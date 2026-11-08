-- 0007 · Platform layer: one login, several apps, access granted per app and denied by default.
-- Task Monitor stays as it is; every existing user is given Task Monitor so nothing changes for them.
-- Safe to run twice.

create table if not exists app (
  code text primary key,
  name text not null,
  description text,
  home_path text not null,
  enabled boolean not null default true,
  position int not null default 0);

insert into app (code, name, description, home_path, enabled, position) values
  ('task_monitor', 'Task Monitor', 'Shutdown tasks, voice updates, photos and reports', '/', true, 1),
  ('furnace_analysis', 'Furnace Analysis', 'Vendor furnace reports, findings and reminders', '/furnace', false, 2)
on conflict (code) do nothing;

-- people who may give and take away app access; added by an operator in the SQL editor, not from the app
create table if not exists platform_admin (user_id uuid primary key references profiles on delete cascade);

create table if not exists app_access (
  user_id uuid not null references profiles on delete cascade,
  app_code text not null references app on delete cascade,
  granted_by uuid references profiles,
  granted_at timestamptz not null default now(),
  primary key (user_id, app_code));

-- ---------------------------------------------------------------- helpers
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admin p where p.user_id = auth.uid());
$$;

create or replace function public.has_app(p_app text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_access x join app a on a.code = x.app_code
                 where x.user_id = auth.uid() and x.app_code = p_app and a.enabled);
$$;

-- the apps the signed-in user may open, in display order
create or replace function public.my_apps() returns setof app
language sql stable security definer set search_path = public as $$
  select a.* from app a join app_access x on x.app_code = a.code
  where x.user_id = auth.uid() and a.enabled order by a.position, a.name;
$$;

-- Task Monitor's own data is behind is_member / has_role, so requiring the app here shuts every Task Monitor table
-- for a user who was not given the app, whatever their area memberships say.
create or replace function public.is_member(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_app('task_monitor') and exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a);
$$;
create or replace function public.has_role(a uuid, roles area_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select has_app('task_monitor') and exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a and m.role = any(roles));
$$;

-- ---------------------------------------------------------------- rules
alter table app enable row level security;
alter table app_access enable row level security;
alter table platform_admin enable row level security;

drop policy if exists app_select on app;
create policy app_select on app for select to authenticated using (true);
drop policy if exists app_access_select on app_access;
create policy app_access_select on app_access for select to authenticated using (user_id = auth.uid() or is_platform_admin());
drop policy if exists platform_admin_select on platform_admin;
create policy platform_admin_select on platform_admin for select to authenticated using (user_id = auth.uid());

-- no direct writes from the app: access changes go through the two functions below
revoke insert, update, delete on app, app_access, platform_admin from authenticated, anon;
revoke all on app, app_access, platform_admin from anon;

-- ---------------------------------------------------------------- give / take away access (platform admins only)
create or replace function public.app_access_set(p_login text, p_app text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if auth.uid() is null or not is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into v_user from profiles where login = lower(trim(p_login)) and active;
  if v_user is null then raise exception 'no such user' using errcode = '22023'; end if;
  if not exists (select 1 from app where code = p_app) then raise exception 'no such app' using errcode = '22023'; end if;
  if p_on then
    insert into app_access (user_id, app_code, granted_by) values (v_user, p_app, auth.uid()) on conflict do nothing;
  else
    delete from app_access where user_id = v_user and app_code = p_app;
  end if;
  insert into audit_log (user_id, action, target_type, target_id, detail)
    values (auth.uid(), case when p_on then 'app_access_granted' else 'app_access_revoked' end, 'user', v_user, jsonb_build_object('app', p_app, 'login', lower(trim(p_login))));
end $$;
revoke execute on function public.app_access_set(text, text, boolean) from public, anon;
grant execute on function public.app_access_set(text, text, boolean) to authenticated, service_role;

-- everyone and what they can open, for the admin screen
create or replace function public.platform_users() returns table (login text, display_name text, active boolean, apps text[])
language sql stable security definer set search_path = public as $$
  select p.login, p.display_name, p.active,
         coalesce((select array_agg(x.app_code order by x.app_code) from app_access x where x.user_id = p.id), '{}')
  from profiles p where is_platform_admin() order by p.display_name;
$$;
revoke execute on function public.platform_users() from public, anon;
grant execute on function public.platform_users() to authenticated, service_role;

grant execute on function public.is_platform_admin(), public.has_app(text), public.my_apps() to authenticated, service_role;

-- ---------------------------------------------------------------- everyone who exists today keeps Task Monitor
insert into app_access (user_id, app_code)
select p.id, 'task_monitor' from profiles p
where exists (select 1 from membership m where m.user_id = p.id)
on conflict do nothing;
