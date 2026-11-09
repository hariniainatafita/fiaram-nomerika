-- Schéma Neon pour la synchronisation `app_state` (adaptateur
-- functions/api/neon/[[path]].js). À exécuter dans chaque projet Neon ajouté
-- au proxy de bascule.

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_state_updated_at_idx ON app_state (updated_at);

-- Le proxy de bascule écrit dans chaque projet : aucune extension ni rôle
-- particulier n'est nécessaire, seulement l'accès SQL de la chaîne Neon.
