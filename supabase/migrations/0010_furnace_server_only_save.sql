-- Security hardening for Furnace Analysis (review of 14 Nov 2026).
-- Saving a scan and logging an email are now done only by the server (service role) after it has checked the signed readings.
-- Before this, an analyst could call fa_scan_save / fa_notification_log directly with their own login and skip the signature check.
-- The new functions also refuse a PDF that is not in the private bucket or that another scan already uses.
-- Idempotent. Paste in the Supabase SQL editor after 0001-0009. Safe to apply before or after the code that uses it:
-- the app falls back to the old functions until this is applied.

create or replace function public.fa_scan_save_srv(p_user uuid, p_scan jsonb, p_readings jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_camp uuid; v_scan uuid; r jsonb;
begin
  if p_user is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'fa-reports' and o.name = p_scan->>'pdf_key') then
    raise exception 'the uploaded PDF was not found' using errcode = '22023';
  end if;
  if exists (select 1 from fa_scan where pdf_key = p_scan->>'pdf_key') then
    raise exception 'this PDF is already attached to a saved scan' using errcode = '23505';
  end if;
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
            p_scan->>'pdf_key', nullif(p_scan->>'pdf_bytes', '')::int, nullif(p_scan->>'limit_version_id', '')::uuid, p_user)
    returning id into v_scan;
  for r in select * from jsonb_array_elements(p_readings) loop
    insert into fa_reading (scan_id, zone, section, avg_mm, min_mm, angle, depth, status)
      values (v_scan, r->>'zone', r->>'section', (r->>'avg_mm')::numeric, (r->>'min_mm')::numeric, r->>'angle', r->>'depth', coalesce(r->>'status', 'unset'));
  end loop;
  insert into audit_log (user_id, action, target_type, target_id, detail)
    values (p_user, 'fa_scan_saved', 'fa_scan', v_scan, jsonb_build_object('heat', p_scan->>'heat', 'meas_no', p_scan->>'meas_no'));
  return v_scan;
end $$;

create or replace function public.fa_notification_log_srv(p_scan uuid, p_email text, p_outcome text, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into fa_notification (scan_id, email, outcome, detail) values (p_scan, p_email, p_outcome, left(p_detail, 300));
end $$;

-- only the server's service role may call the new functions; the old ones are closed to signed-in users
revoke execute on function public.fa_scan_save_srv(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.fa_scan_save_srv(uuid, jsonb, jsonb) to service_role;
revoke execute on function public.fa_notification_log_srv(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.fa_notification_log_srv(uuid, text, text, text) to service_role;
revoke execute on function public.fa_scan_save(jsonb, jsonb) from authenticated;
revoke execute on function public.fa_notification_log(uuid, text, text, text) from authenticated;
