-- SPEC-006: the shared plant catalogue. Not user-scoped — readable by every
-- authenticated user, written only by the import script (scripts/import-plants.ts)
-- via the service-role key, so there's no INSERT/UPDATE policy at all.

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  scientific_name text not null unique,
  common_name text,
  synonyms text[] not null default '{}',
  description text,
  -- why: always an external RHS/Beth Chatto URL, never a Supabase Storage
  -- path — see the app page's Decision Log on hotlinking vs. mirroring images.
  image_url text,
  source text not null check (source in ('rhs', 'bethchatto')),
  source_url text not null unique,
  family text,
  genus text,
  habit text,
  foliage text,
  native_gb boolean,
  soil_types text[] not null default '{}',
  moisture text,
  ph text,
  position text[] not null default '{}',
  aspect text,
  exposure text,
  hardiness text,
  height_range text,
  spread_range text,
  geo_tags text[] not null default '{}' check (geo_tags <@ array['UK', 'Global']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plants_genus_idx on public.plants (genus);
create index plants_geo_tags_idx on public.plants using gin (geo_tags);

alter table public.plants enable row level security;

create trigger plants_set_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

create policy plants_select_all
on public.plants
for select
to authenticated
using (true);
