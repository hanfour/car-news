-- Create function to get popular tags efficiently using database aggregation
CREATE OR REPLACE FUNCTION get_popular_tags(tag_limit INT DEFAULT 30)
RETURNS TABLE (name TEXT, count BIGINT) AS $$
  SELECT
    tag as name,
    COUNT(*) as count
  FROM
    generated_articles,
    jsonb_array_elements_text(tags) as tag
  WHERE
    published = true
    AND tags IS NOT NULL
  GROUP BY tag
  ORDER BY count DESC
  LIMIT tag_limit;
$$ LANGUAGE SQL STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_popular_tags IS 'Returns the most popular tags from published articles, sorted by frequency';
