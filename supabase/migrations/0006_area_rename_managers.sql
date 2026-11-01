-- CR-8: managers may rename the area as well as area admins. The area code (bf1, used for scoping) is never editable:
-- the column grant from 0004 stays `update (name)` only, and the audit trigger still writes one `area_renamed` row per rename.
-- Idempotent: replaces the area_update policy. Paste-able in the SQL editor after 0001-0005.

drop policy if exists area_update on area;
create policy area_update on area for update
  using (has_role(id, '{area_admin,manager}'))
  with check (has_role(id, '{area_admin,manager}'));
