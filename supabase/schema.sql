-- MatrixODC · schéma de la base
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Sans danger si relancé : rien n'est effacé.

create table if not exists public.actions (
  id          text primary key,
  title       text not null,
  ws          text not null default 'pil',
  owner       text not null default '',
  due         date,
  prio        text not null default 'normale' check (prio in ('critique', 'haute', 'normale')),
  status      text not null default 'todo'    check (status in ('todo', 'doing', 'blocked', 'done')),
  blocker     text not null default '',
  note        text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists actions_ws_idx on public.actions (ws);
create index if not exists actions_owner_idx on public.actions (owner);

-- Journal des modifications (qui a changé quoi, et quand)
create table if not exists public.activity (
  id           bigint generated always as identity primary key,
  action_id    text,
  action_title text,
  who          text,
  what         text not null,
  at           timestamptz not null default now()
);

create index if not exists activity_at_idx on public.activity (at desc);

-- Sécurité : aucune lecture ni écriture possible depuis l'extérieur.
-- Seule l'application, avec la clé service_role gardée sur Vercel, accède aux données.
alter table public.actions  enable row level security;
alter table public.activity enable row level security;
revoke all on public.actions  from anon, authenticated;
revoke all on public.activity from anon, authenticated;

-- Déroulé du 30 octobre (moments modifiables en mode admin)
create table if not exists public.segments (
  id            text primary key,
  start_time    text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min  integer not null check (duration_min between 1 and 600),
  title         text not null,
  updated_at    timestamptz not null default now()
);

alter table public.segments enable row level security;
revoke all on public.segments from anon, authenticated;
