-- Fix comments_count race condition
-- Priority: P2 - Prevents incorrect count due to concurrent inserts
-- Uses COUNT(*) instead of increment to ensure accuracy

-- Replace the increment-based trigger with a count-based one
CREATE OR REPLACE FUNCTION update_article_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Always recalculate from actual count to prevent race conditions
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    -- Determine which article_id to update
    DECLARE
      target_article_id TEXT;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        target_article_id := OLD.article_id;
      ELSE
        target_article_id := NEW.article_id;
      END IF;

      -- Atomic count update - eliminates race conditions
      UPDATE generated_articles
      SET comments_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE article_id = target_article_id
          AND is_approved = true
      )
      WHERE id = target_article_id;
    END;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger remains the same, just using the fixed function
DROP TRIGGER IF EXISTS trigger_update_comments_count ON public.comments;
CREATE TRIGGER trigger_update_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_article_comments_count();

-- Add comment
COMMENT ON FUNCTION update_article_comments_count IS 'Fixed race condition by using COUNT(*) instead of increment. Ensures accurate count in concurrent scenarios. Added 2025-01-12';

-- Optional: Fix existing incorrect counts (run once)
-- Uncomment and run manually if needed:
-- UPDATE generated_articles ga
-- SET comments_count = (
--   SELECT COUNT(*)
--   FROM comments c
--   WHERE c.article_id = ga.id AND c.is_approved = true
-- );
