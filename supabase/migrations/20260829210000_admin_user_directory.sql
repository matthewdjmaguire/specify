-- SPEC-021: admin user directory. The actual data-minimisation enforcement
-- point (per the app page's ADR) — this function's return type is fixed to
-- exactly these five identity columns, so it is structurally incapable of
-- returning quiz_attempts/quiz_questions/plant_stats data no matter how it's
-- called. SECURITY DEFINER is required to read auth.users (email lives
-- there, not in profiles); `where public.is_admin()` gates every row on the
-- caller's own admin status, so a non-admin caller gets zero rows back
-- rather than an error — consistent with how RLS itself behaves elsewhere
-- in this schema (profiles.rls.test.ts: another user's row is invisible,
-- not a 403).
create or replace function public.admin_user_directory()
returns table (
  id uuid,
  display_name text,
  email text,
  is_admin boolean,
  is_primary_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, u.email, p.is_admin, p.is_primary_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin();
$$;

revoke all on function public.admin_user_directory() from public;
grant execute on function public.admin_user_directory() to authenticated;
