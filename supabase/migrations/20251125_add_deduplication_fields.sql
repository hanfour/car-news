-- Migration: Add deduplication fields to raw_articles
-- Purpose: Track which raw articles have been used in generated articles

-- Add used_in_article_id field to raw_articles
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS used_in_article_id CHAR(7) REFERENCES generated_articles(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_raw_articles_used_in
ON raw_articles(used_in_article_id)
WHERE used_in_article_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN raw_articles.used_in_article_id IS
'ID of the generated article that used this raw article. NULL means unused.';
