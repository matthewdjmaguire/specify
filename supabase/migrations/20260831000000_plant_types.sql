-- why a new column, not repurposing habit: habit is a growth-*form*
-- descriptor ("Bushy", "Columnar upright") — plant_types is RHS's own
-- broader classification ("Trees", "Herbaceous Perennial", "Climber", ...),
-- a much better fit for a browsing/filtering "type" than habit ever was.
-- A plant can have more than one (e.g. "Climber" + "Wall Shrub"), hence an
-- array, matching soil_types/position's existing shape.
alter table public.plants
  add column plant_types text[] not null default '{}';
