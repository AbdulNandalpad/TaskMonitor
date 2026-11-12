-- 0009 · Furnace Analysis: list of role holders for the settings screen, and clean-up of PDFs that were uploaded but never saved.
-- Needs 0008. Safe to run twice.

-- who has which Furnace Analysis role (administrators only; profiles are not readable across areas, hence a function)
create or replace function public.fa_roles_list() returns table (login text, display_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.login, p.display_name, r.role::text
  from fa_role r join profiles p on p.id = r.user_id
  where fa_is_admin()
  order by p.display_name;
$$;
revoke execute on function public.fa_roles_list() from public, anon;
grant execute on function public.fa_roles_list() to authenticated, service_role;

-- an analyst may delete a PDF they uploaded, but only while no saved scan uses it (Discard on the upload screen)
drop policy if exists fa_reports_delete on storage.objects;
create policy fa_reports_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fa-reports' and public.fa_can_edit() and owner = auth.uid()
         and not exists (select 1 from public.fa_scan s where s.pdf_key = name));
