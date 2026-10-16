-- MatrixODC · déroulé modifiable (heures, durées et titres des moments du 30 octobre)
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Sans danger si relancé : rien n'est effacé, un moment déjà présent n'est jamais écrasé.

create table if not exists public.segments (
  id            text primary key,
  start_time    text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min  integer not null check (duration_min between 1 and 600),
  title         text not null,
  updated_at    timestamptz not null default now()
);

alter table public.segments enable row level security;
revoke all on public.segments from anon, authenticated;

insert into public.segments (id, start_time, duration_min, title) values
  ('s1', '17:00', 5,  'Accueil par le CEO et le DG'),
  ('s2', '17:05', 10, 'Présentation Sonatel & Sonatel Academy'),
  ('s3', '17:15', 15, 'Rencontre de 2 entrepreneurs du digital'),
  ('s4', '17:30', 15, 'École du Code : étudiants et formateurs'),
  ('s5', '17:45', 25, 'FabLab : démos et 2 pitchs'),
  ('s6', '18:10', 5,  'Photo de groupe et départ')
on conflict (id) do nothing;
