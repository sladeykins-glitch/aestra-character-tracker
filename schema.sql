-- Aestra Fabula Ultima Character Tracker
-- Run this in Supabase: SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_gm boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Unnamed',
  player_name text not null default '',
  identity text not null default '',
  theme text not null default '',
  origin text not null default '',
  level integer not null default 1 check (level between 1 and 50),
  portrait_url text not null default '',
  mig text not null default 'd8' check (mig in ('d6','d8','d10','d12')),
  dex text not null default 'd8' check (dex in ('d6','d8','d10','d12')),
  ins text not null default 'd8' check (ins in ('d6','d8','d10','d12')),
  wlp text not null default 'd8' check (wlp in ('d6','d8','d10','d12')),
  hp_current integer not null default 1,
  hp_max integer not null default 1,
  mp_current integer not null default 0,
  mp_max integer not null default 0,
  ip_current integer not null default 0,
  ip_max integer not null default 0,
  fabula_points integer not null default 0,
  initiative integer not null default 0,
  defence integer not null default 0,
  magic_defence integer not null default 0,
  crisis integer not null default 0,
  statuses text[] not null default '{}',
  classes text not null default '',
  skills text not null default '',
  equipment text not null default '',
  spells text not null default '',
  bonds text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, owner_id)
);

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.characters enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Profiles: each user can read themselves; GMs can read all profiles.
drop policy if exists "profiles read self or gm" on public.profiles;
create policy "profiles read self or gm" on public.profiles for select to authenticated
using (id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm));

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Campaigns: authenticated users may read campaign records.
drop policy if exists "campaigns authenticated read" on public.campaigns;
create policy "campaigns authenticated read" on public.campaigns for select to authenticated using (true);

-- Characters: owner can read/write own. GM can read/write all.
drop policy if exists "characters read owner or gm" on public.characters;
create policy "characters read owner or gm" on public.characters for select to authenticated
using (owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm));

drop policy if exists "characters insert owner or gm" on public.characters;
create policy "characters insert owner or gm" on public.characters for insert to authenticated
with check (owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm));

drop policy if exists "characters update owner or gm" on public.characters;
create policy "characters update owner or gm" on public.characters for update to authenticated
using (owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm))
with check (owner_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm));

drop policy if exists "characters delete gm" on public.characters;
create policy "characters delete gm" on public.characters for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_gm));

-- IMPORTANT SETUP AFTER RUNNING THIS FILE:
-- 1) Create your first account in the app.
-- 2) In Table Editor -> profiles, set your account's is_gm to true.
-- 3) Create one campaign row and copy its UUID into config.js as campaignId.
