-- ============================================================
-- BREADCRUMBS v2 — Onboarding v3: Family Profile + Members
-- Run AFTER supabase_hardening.sql
-- Safe to run on the live database. Additive only except for
-- dropping NOT NULL on child_name / child_dob (which is safe
-- since we backfill those rows into family_members below).
-- ============================================================

-- ── 1. Evolve users table ─────────────────────────────────────
-- Drop NOT NULL from legacy single-child columns so new signups
-- (which use family_members) are not rejected.
alter table public.users
  alter column child_name drop not null;

alter table public.users
  alter column child_dob drop not null;

-- Add owner identity fields.
alter table public.users
  add column if not exists family_name       text,
  add column if not exists role              text not null default 'parent',
  add column if not exists custom_role_label text;

-- ── 2. Create family_members table ───────────────────────────
create table if not exists public.family_members (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  name                text not null,
  role                text not null default 'child',
  custom_role_label   text,
  birth_date          date,
  created_at          timestamptz default now()
);

create index if not exists idx_family_members_user_id
  on public.family_members(user_id);

-- ── 3. RLS for family_members ─────────────────────────────────
alter table public.family_members enable row level security;

-- DROP IF EXISTS makes the migration safely re-runnable.
drop policy if exists "family_members: owner select" on public.family_members;
drop policy if exists "family_members: owner insert" on public.family_members;
drop policy if exists "family_members: owner update" on public.family_members;
drop policy if exists "family_members: owner delete" on public.family_members;

create policy "family_members: owner select"
  on public.family_members for select
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "family_members: owner insert"
  on public.family_members for insert
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "family_members: owner update"
  on public.family_members for update
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  )
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "family_members: owner delete"
  on public.family_members for delete
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

-- ── 4. Make entries.child_name nullable ───────────────────────
-- New entries use family_members as the canonical recipient source.
-- Existing entries keep their denormalized child_name unchanged.
alter table public.entries
  alter column child_name drop not null;

-- ── 5. Backfill existing users into family_members ────────────
-- Any real user who signed up before this migration has child_name
-- and child_dob on their users row. Migrate those into family_members
-- so they get the same family-member-aware experience going forward.
insert into public.family_members (user_id, name, role, birth_date)
select
  u.id,
  u.child_name,
  'child',
  u.child_dob
from public.users u
where u.child_name is not null
  and u.auth_user_id is not null
  and not exists (
    select 1 from public.family_members fm where fm.user_id = u.id
  );
