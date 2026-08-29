-- SPEC-004: profiles, allowed_emails, signup trigger, RLS.
-- Applied directly via psql against POSTGRES_URL_NON_POOLING (see README) —
-- no Supabase CLI login on this machine, so no `supabase db push`.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  is_allowed boolean not null default false,
  is_admin boolean not null default false,
  is_primary_admin boolean not null default false,
  geo_scope text not null default 'UK' check (geo_scope in ('UK', 'Global')),
  quiz_length integer not null default 20 check (quiz_length in (20, 50, 100)),
  followup_count integer not null default 1 check (followup_count between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Invite allow-list. No RLS policies at all (beyond ENABLE ROW LEVEL
-- SECURITY, which with zero policies denies everything to non-service-role
-- connections) — only admin server actions, running with the service-role
-- key, ever need to touch this table.
create table public.allowed_emails (
  email text primary key,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

insert into public.allowed_emails (email) values ('matthewdjmaguire@gmail.com');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- why: a plain RLS policy can't cleanly express "this user may update their
-- own row, except these three columns" — WITH CHECK only sees the proposed
-- new row, not a reliable view of the old one to diff against. A trigger that
-- runs for every UPDATE regardless of RLS is the standard, unambiguous way to
-- enforce column-level protection: normal (non-service-role) writers get
-- rejected outright if they touch is_admin/is_primary_admin/is_allowed, while
-- admin server actions (which use the service-role key, and so bypass RLS by
-- Supabase's own design) are unaffected — auth.role() reports 'service_role'
-- for those. The primary-admin guard below applies unconditionally, even to
-- service-role, because it's a true invariant, not just a client restriction.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.is_primary_admin then
      raise exception 'the primary admin account cannot be deleted';
    end if;
    return old;
  end if;

  if auth.role() <> 'service_role' and (
    new.is_admin is distinct from old.is_admin
    or new.is_primary_admin is distinct from old.is_primary_admin
    or new.is_allowed is distinct from old.is_allowed
  ) then
    raise exception 'is_admin, is_primary_admin, and is_allowed can only be changed by an admin action';
  end if;

  if old.is_primary_admin and (new.is_primary_admin is not true or new.is_admin is not true) then
    raise exception 'the primary admin cannot be demoted or have primary-admin status removed';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.profiles_guard();

create trigger profiles_guard_delete
before delete on public.profiles
for each row execute function public.profiles_guard();

-- why: auto-provision a profiles row on signup rather than requiring a
-- separate client-side insert — a user is never left without a row (which
-- every RLS policy and every later feature assumes exists). SECURITY DEFINER
-- is required because this fires as part of the auth.users insert, before
-- the new user has any session/role to act as themselves.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_allowed_email boolean;
  is_primary_admin_email boolean;
begin
  is_allowed_email := exists (
    select 1 from public.allowed_emails where email = new.email
  );
  is_primary_admin_email := (new.email = 'matthewdjmaguire@gmail.com');

  insert into public.profiles (id, display_name, is_allowed, is_admin, is_primary_admin)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    is_allowed_email,
    is_primary_admin_email,
    is_primary_admin_email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Users may read and update only their own row. There is no admin-bypass
-- read policy here by design (see the app page's Decision Log): the admin
-- directory is served by a separate, narrowly-scoped path (SPEC-021), not by
-- widening this policy.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
