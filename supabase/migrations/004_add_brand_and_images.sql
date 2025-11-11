-- 添加品牌分組和多圖片支持

-- 1. 給 generated_articles 添加品牌和圖片欄位
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS primary_brand TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. 添加索引以提升查詢效率
CREATE INDEX IF NOT EXISTS idx_generated_articles_primary_brand
ON generated_articles(primary_brand);

-- 3. 給 raw_articles 添加品牌欄位（用於預處理）
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS extracted_brands TEXT[] DEFAULT '{}';

-- 4. 添加註釋
COMMENT ON COLUMN generated_articles.primary_brand IS 'Primary car brand for this article (e.g., Tesla, BMW)';
COMMENT ON COLUMN generated_articles.images IS 'Array of images with URLs, credits, and captions';
COMMENT ON COLUMN raw_articles.extracted_brands IS 'List of car brands mentioned in the article';

-- 5. 示例 images 格式
-- [
--   {"url": "https://...", "credit": "AutoHome", "caption": "內裝照片"},
--   {"url": "https://...", "credit": "Car.com", "caption": "外觀照片"}
-- ]
