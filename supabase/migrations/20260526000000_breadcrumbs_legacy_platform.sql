alter table public.profiles
  add column if not exists phone text,
  add column if not exists family_name text,
  add column if not exists custom_role_label text;

alter table public.family_members
  add column if not exists name text,
  add column if not exists birth_date date,
  add column if not exists custom_role_label text;

alter table public.breadcrumbs
  add column if not exists parent_id uuid,
  add column if not exists family_member_id uuid,
  add column if not exists breadcrumb_type text,
  add column if not exists domain text,
  add column if not exists relevant_age integer,
  add column if not exists delivery_type text default 'future_reading';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'breadcrumbs_type_check'
  ) then
    alter table public.breadcrumbs add constraint breadcrumbs_type_check
      check (
        breadcrumb_type is null or breadcrumb_type in (
          'Letter',
          'Story',
          'Life Lesson',
          'Advice',
          'Memory',
          'Value',
          'Reflection'
        )
      );
  end if;
end $$;

create table if not exists public.family_foundations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.ai_request_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.family_foundations enable row level security;
alter table public.ai_request_events enable row level security;

drop policy if exists "Creators can manage their own foundation" on public.family_foundations;
create policy "Creators can manage their own foundation"
  on public.family_foundations
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = family_foundations.user_id
      and profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = family_foundations.user_id
      and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Creators can read their AI request events" on public.ai_request_events;
create policy "Creators can read their AI request events"
  on public.ai_request_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = ai_request_events.user_id
      and profiles.user_id = auth.uid()
    )
  );
