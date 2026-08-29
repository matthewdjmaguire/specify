-- Favourite-plant flag, added to the existing per-user-per-plant
-- plant_stats table rather than a new join table — it's already exactly
-- the right shape (user_id, plant_id primary key), and the existing
-- plant_stats_owner RLS policy already covers it with no changes needed.
alter table public.plant_stats
  add column is_favourite boolean not null default false;

create index plant_stats_favourites_idx
  on public.plant_stats (user_id)
  where is_favourite;
