-- Fix: Change published_at from DATE to TIMESTAMPTZ to include actual time
-- This fixes the issue where all articles show "08:00" instead of real creation time

-- 1. Change column type from DATE to TIMESTAMPTZ
ALTER TABLE generated_articles
  ALTER COLUMN published_at TYPE TIMESTAMPTZ
  USING published_at::timestamptz;

-- 2. Update trigger to use NOW() instead of CURRENT_DATE
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update existing articles to use created_at time portion
-- This preserves the date but adds the actual creation time
UPDATE generated_articles
SET published_at = (published_at::date || ' ' || created_at::time)::timestamptz
WHERE published_at IS NOT NULL;
