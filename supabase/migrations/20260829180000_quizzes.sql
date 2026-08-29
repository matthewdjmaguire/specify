-- SPEC-007: quiz_themes, quiz_attempts, quiz_questions, plant_stats + RLS.
-- The hardest RLS surface in the app: quiz_themes has both a shared
-- (global/curated, admin-writable) and a personal (owner-writable) mode,
-- while quiz_attempts/quiz_questions/plant_stats are fully owner-scoped with
-- no admin bypass at all — the admin role is identity-management only (see
-- SPEC-021's ADR on the app page).

-- why SECURITY DEFINER: lets policies check "is the caller an admin" via a
-- single reusable function instead of repeating the subquery everywhere.
-- Safe here because it only ever checks the caller's own row (auth.uid()),
-- never attacker-supplied input, and returns nothing but a boolean.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table public.quiz_themes (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  prompt text not null default '',
  owner_id uuid references auth.users (id) on delete cascade,
  is_global boolean not null default false,
  is_lucky_dip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_themes_ownership check (
    (is_global and owner_id is null) or (not is_global and owner_id is not null)
  )
);

alter table public.quiz_themes enable row level security;

create trigger quiz_themes_set_updated_at
before update on public.quiz_themes
for each row execute function public.set_updated_at();

-- why: "Lucky Dip" must always exist per the brief — a plain RLS/ownership
-- check can't express "this specific row is special", so guard it the same
-- way profiles_guard protects the primary admin.
create or replace function public.protect_lucky_dip()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.is_lucky_dip then
      raise exception 'the Lucky Dip theme cannot be deleted';
    end if;
    return old;
  end if;
  if old.is_lucky_dip and (new.is_lucky_dip is not true or new.is_global is not true) then
    raise exception 'the Lucky Dip theme cannot stop being global or lose its Lucky Dip flag';
  end if;
  return new;
end;
$$;

create trigger quiz_themes_protect_lucky_dip
before update or delete on public.quiz_themes
for each row execute function public.protect_lucky_dip();

insert into public.quiz_themes (display_name, prompt, owner_id, is_global, is_lucky_dip)
values ('Lucky Dip', '', null, true, true);

create policy quiz_themes_select
on public.quiz_themes
for select
to authenticated
using (is_global or owner_id = auth.uid());

create policy quiz_themes_insert
on public.quiz_themes
for insert
to authenticated
with check (
  (not is_global and owner_id = auth.uid())
  or (is_global and public.is_admin())
);

create policy quiz_themes_update
on public.quiz_themes
for update
to authenticated
using ((not is_global and owner_id = auth.uid()) or (is_global and public.is_admin()))
with check ((not is_global and owner_id = auth.uid()) or (is_global and public.is_admin()));

create policy quiz_themes_delete
on public.quiz_themes
for delete
to authenticated
using ((not is_global and owner_id = auth.uid()) or (is_global and public.is_admin()));

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  theme_id uuid not null references public.quiz_themes (id) on delete cascade,
  mode text not null check (mode in ('learning', 'intermediate', 'hard')),
  question_count integer not null check (question_count > 0),
  geo_scope text not null check (geo_scope in ('UK', 'Global')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.quiz_attempts enable row level security;

-- why no admin bypass anywhere on this table (or quiz_questions/plant_stats
-- below): per the app page's ADR, the admin role is identity-management
-- only. If a genuine support need to inspect a user's quiz data ever arises,
-- that's a deliberate future decision, not something already quietly allowed.
create policy quiz_attempts_owner
on public.quiz_attempts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  plant_id uuid not null references public.plants (id),
  question_type text not null check (question_type = 'name' or question_type like 'characteristic:%'),
  sequence integer not null,
  status text not null default 'unanswered' check (status in ('correct', 'incorrect', 'skipped', 'unanswered')),
  user_answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quiz_questions_attempt_idx on public.quiz_questions (attempt_id);

alter table public.quiz_questions enable row level security;

create trigger quiz_questions_set_updated_at
before update on public.quiz_questions
for each row execute function public.set_updated_at();

-- why a subquery instead of a user_id column here: quiz_questions belongs to
-- an attempt, not directly to a user — ownership is checked through the
-- parent attempt, which is itself owner-scoped above.
create policy quiz_questions_owner
on public.quiz_questions
for all
to authenticated
using (exists (
  select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()
))
with check (exists (
  select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()
));

create table public.plant_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  times_seen integer not null default 0,
  times_correct integer not null default 0,
  times_incorrect integer not null default 0,
  priority_weight real not null default 1.0,
  last_seen_at timestamptz,
  primary key (user_id, plant_id)
);

alter table public.plant_stats enable row level security;

create policy plant_stats_owner
on public.plant_stats
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
