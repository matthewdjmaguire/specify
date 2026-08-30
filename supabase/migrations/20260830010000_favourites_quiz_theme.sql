-- "Quiz me on my Favourites": reuses the existing theme -> attempt
-- machinery rather than inventing a parallel non-theme quiz flow —
-- quiz_attempts.theme_id is a required FK, so each user gets one
-- lazily-created personal theme flagged is_favourites, which
-- startQuizAttemptCore special-cases to pull from plant_stats.is_favourite
-- instead of prompt-filtering. Not shown in theme-management/browsing UI
-- (settings/quizzes, /quizzes, the sidebar) — reached only via a dedicated
-- button on /favourites.
alter table public.quiz_themes
  add column is_favourites boolean not null default false;

-- why unique per owner, not a general index: at most one "My Favourites"
-- theme should ever exist per user — getOrCreateFavouritesThemeCore relies
-- on this to make "get or create" race-safe (a concurrent insert violates
-- the constraint rather than creating a duplicate).
create unique index quiz_themes_one_favourites_theme_per_owner
  on public.quiz_themes (owner_id)
  where is_favourites;
