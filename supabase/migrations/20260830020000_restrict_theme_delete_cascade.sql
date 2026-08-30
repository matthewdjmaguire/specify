-- why: quiz_attempts.theme_id was `on delete cascade`. Postgres FK cascade
-- actions bypass RLS entirely on the referencing table (documented Postgres
-- behaviour), so deleting a global theme — allowed for any is_admin user,
-- not just the primary admin — silently destroyed every user's quiz_attempts
-- (and transitively quiz_questions) for that theme, with the "no admin
-- bypass" RLS policies on those tables never consulted. That's a real
-- cross-user data-destruction path contradicting the app's own ADR that
-- admins have zero effect on other users' quiz data (2026-08-30 security
-- review finding). Switched to `restrict`: a theme with existing attempts
-- can no longer be deleted at all, by anyone, until the app deliberately
-- decides what "retiring a theme" should mean.
alter table public.quiz_attempts
  drop constraint quiz_attempts_theme_id_fkey,
  add constraint quiz_attempts_theme_id_fkey
    foreign key (theme_id) references public.quiz_themes (id) on delete restrict;
