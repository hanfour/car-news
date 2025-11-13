-- Fix search_articles function type mismatch
-- Issue: id column is character(7), not TEXT
-- Date: 2025-11-13

-- Drop existing function
DROP FUNCTION IF EXISTS search_articles(TEXT, INT);

-- Recreate with correct return types matching the actual table structure
CREATE OR REPLACE FUNCTION search_articles(search_query TEXT, result_limit INT DEFAULT 30)
RETURNS TABLE (
  id character(7),        -- Fixed: was TEXT, actual type is character(7)
  title_zh TEXT,
  content_zh TEXT,
  published_at date,      -- Fixed: actual type is date, not TIMESTAMPTZ
  cover_image TEXT,
  categories TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.id::character(7),  -- Explicit cast to match return type
    ga.title_zh,
    ga.content_zh,
    ga.published_at::date,  -- Explicit cast to match return type
    ga.cover_image,
    ga.categories,
    -- Calculate relevance rank (title matches are weighted higher)
    (
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, '')),
        plainto_tsquery('simple', search_query)
      ) +
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '')),
        plainto_tsquery('simple', search_query)
      ) * 2
    )::REAL AS rank  -- Title matches get 2x weight
  FROM
    public.generated_articles ga
  WHERE
    ga.published = true
    AND (
      to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, ''))
      @@ plainto_tsquery('simple', search_query)
    )
  ORDER BY
    rank DESC,
    ga.published_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_articles IS 'Fast full-text search for articles using PostgreSQL tsvector. Uses "simple" dictionary for Chinese text. Fixed type mismatch - added 2025-11-13';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_articles TO anon, authenticated;
