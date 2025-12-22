-- Migration: Switch from OpenAI (1536-dim) to Gemini (768-dim) embeddings
-- Date: 2025-12-22
-- Reason: OpenAI API quota exceeded, Gemini is free

-- 1. Clear existing embeddings (will be regenerated with Gemini)
UPDATE raw_articles SET embedding = NULL;
UPDATE article_clusters SET centroid = NULL;

-- 2. Drop existing index (required before altering column type)
DROP INDEX IF EXISTS idx_raw_articles_embedding;

-- 3. Alter column dimensions from 1536 to 768
ALTER TABLE raw_articles
  ALTER COLUMN embedding TYPE VECTOR(768);

ALTER TABLE article_clusters
  ALTER COLUMN centroid TYPE VECTOR(768);

-- 4. Recreate index for 768-dim vectors
CREATE INDEX idx_raw_articles_embedding ON raw_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Log the migration
INSERT INTO cron_logs (job_name, status, metadata) VALUES (
  'migration',
  'success',
  '{"migration": "20251222_migrate_to_gemini_embedding", "old_dim": 1536, "new_dim": 768}'::jsonb
);
