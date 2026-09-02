-- Secours manuel si les migrations Knex de production échouent.
-- À exécuter uniquement dans la console SQL de la base PostgreSQL Render.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dedup_hash VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_jobs_dedup_hash ON jobs(dedup_hash);
