-- 添加标签和今日要闻功能

-- 1. 给 generated_articles 添加标签字段
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS brands TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS car_models TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_generated_articles_is_featured ON generated_articles(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_generated_articles_brands ON generated_articles USING GIN(brands);
CREATE INDEX IF NOT EXISTS idx_generated_articles_car_models ON generated_articles USING GIN(car_models);
CREATE INDEX IF NOT EXISTS idx_generated_articles_categories ON generated_articles USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_generated_articles_tags ON generated_articles USING GIN(tags);

-- 3. 创建标签统计视图
CREATE OR REPLACE VIEW tag_statistics AS
SELECT
  unnest(brands) as brand,
  COUNT(*) as article_count
FROM generated_articles
WHERE published = true AND brands IS NOT NULL
GROUP BY brand
ORDER BY article_count DESC;

-- 4. 创建热门标签视图
CREATE OR REPLACE VIEW popular_tags AS
SELECT
  jsonb_array_elements_text(tags) as tag,
  COUNT(*) as usage_count
FROM generated_articles
WHERE published = true
GROUP BY tag
ORDER BY usage_count DESC
LIMIT 50;

COMMENT ON COLUMN generated_articles.tags IS 'JSON array of tags extracted by AI';
COMMENT ON COLUMN generated_articles.is_featured IS 'Mark as featured/today headline';
COMMENT ON COLUMN generated_articles.brands IS 'Car brands mentioned (e.g., Tesla, BMW)';
COMMENT ON COLUMN generated_articles.car_models IS 'Car models mentioned (e.g., Model 3, X5)';
COMMENT ON COLUMN generated_articles.categories IS 'Article categories (e.g., 新車, 評測, 行業)';
