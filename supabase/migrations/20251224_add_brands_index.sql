-- Performance Optimization: Add GIN index for brands array
-- Used by: Related articles query (contains brands filter)

-- Index for brands array search
CREATE INDEX IF NOT EXISTS idx_articles_brands
ON public.generated_articles USING GIN(brands)
WHERE published = true;

-- Analyze to update statistics
ANALYZE public.generated_articles;

COMMENT ON INDEX idx_articles_brands IS 'Optimizes related articles query using brands array filter - added 2025-12-24';
