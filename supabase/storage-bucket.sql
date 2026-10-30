-- =====================================================================
-- FIARAM NUMERIQUE - Bucket de stockage des médias (photos, audio, PDF)
-- A executer dans : Supabase Dashboard > SQL Editor > New query > RUN
-- =====================================================================

-- Bucket public : les fichiers sont servis par URL https directe (CDN Supabase).
insert into storage.buckets (id, name, public)
values ('fiaram-media', 'fiaram-media', true)
on conflict (id) do nothing;

-- Televersements autorises pour tous les usages (mesme posture d'ouverture
-- que app_state ; a durcir plus tard lors du passage a Supabase Auth).
drop policy if exists "fiaram_media_anon_all" on storage.objects;
create policy "fiaram_media_anon_all"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'fiaram-media')
  with check (bucket_id = 'fiaram-media');
