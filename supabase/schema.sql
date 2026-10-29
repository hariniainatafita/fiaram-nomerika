-- =====================================================================
-- FIARAM NUMERIQUE - Synchronisation partagee (Supabase)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- Table cle/valeur qui miroite les donnees de l'application (localStorage).
-- Chaque ligne correspond a une collection : membres, presences, cotisations...
create table if not exists public.app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Necessaire pour recevoir les anciennes valeurs lors des suppressions (Realtime).
alter table public.app_state replica identity full;

-- Securite au niveau des lignes (RLS).
alter table public.app_state enable row level security;

-- MVP : acces anonyme en lecture/ecriture.
-- ATTENTION : a durcir avec Supabase Auth avant une mise en production publique.
drop policy if exists "app_state_anon_all" on public.app_state;
create policy "app_state_anon_all"
  on public.app_state
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Active le temps reel pour cette table.
-- (Si la commande renvoie "already member of publication", c'est deja fait.)
alter publication supabase_realtime add table public.app_state;
