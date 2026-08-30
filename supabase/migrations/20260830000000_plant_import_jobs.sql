-- Admin-triggered plant ingestion, processed incrementally by a Vercel Cron
-- job rather than a single request — RHS's page-fetch rate limit (350ms
-- between requests, unchanged from the original SPEC-001 scraper) means a
-- run of any real size would exceed a serverless function's execution
-- window, so a job is worked in small ticks across repeated cron
-- invocations instead of one long-running request.
create table public.plant_import_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users (id) on delete set null,
  genus text not null,
  -- why capped at 100: this is a manual, admin-triggered top-up of the
  -- curated seed set, not a general-purpose crawler — see the standing
  -- RHS bulk-scraping legal-risk note in the app's Decision Log. A hard
  -- cap keeps a single job from turning into exactly that.
  target_count integer not null check (target_count > 0 and target_count <= 100),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  -- why the full candidate URL list is stored on the job, not recomputed
  -- every tick: it's derived from RHS's ~306k-URL sitemap set (7 fetches),
  -- which would otherwise be re-fetched on every single cron tick for the
  -- life of the job.
  candidate_urls jsonb,
  next_candidate_index integer not null default 0,
  fetched_count integer not null default 0,
  imported_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plant_import_jobs enable row level security;

create trigger plant_import_jobs_set_updated_at
before update on public.plant_import_jobs
for each row execute function public.set_updated_at();

-- why is_admin() for select too, not just write: this is a shared admin
-- view (any admin can see any job's progress), not owner-scoped like a
-- personal quiz theme.
create policy plant_import_jobs_admin_all
on public.plant_import_jobs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
