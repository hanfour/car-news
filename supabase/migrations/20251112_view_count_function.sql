-- Atomic view count increment function
-- Priority: P0 - Fixes race condition in view counting
-- Prevents concurrent update conflicts

CREATE OR REPLACE FUNCTION increment_view_count(article_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Atomic UPDATE - no race conditions
  UPDATE public.generated_articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id AND published = true;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Add comment
COMMENT ON FUNCTION increment_view_count IS 'Atomically increments article view count. Prevents race conditions. Added 2025-01-12';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_view_count TO anon, authenticated;
