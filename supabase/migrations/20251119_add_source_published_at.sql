-- 為 raw_articles 和 generated_articles 添加原始發布時間欄位
-- 這樣我們就可以使用英文原文的發布時間，而不是爬取或生成的時間

-- 1. 為 raw_articles 添加 source_published_at 欄位
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;

-- 添加索引以提升查詢效率（按發布時間排序）
CREATE INDEX IF NOT EXISTS idx_raw_articles_source_published_at
ON raw_articles(source_published_at DESC NULLS LAST);

-- 添加註釋
COMMENT ON COLUMN raw_articles.source_published_at IS 'Original publication timestamp from source article (UTC)';

-- 2. 為 generated_articles 添加 source_published_at 欄位
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;

-- 添加索引以提升查詢效率
CREATE INDEX IF NOT EXISTS idx_generated_articles_source_published_at
ON generated_articles(source_published_at DESC NULLS LAST);

-- 添加註釋
COMMENT ON COLUMN generated_articles.source_published_at IS 'Original publication timestamp from source articles, used for published_at conversion to Taiwan timezone';

-- 3. 修改 published_at 的註釋，說明它應該是 source_published_at 轉換為台灣時區後的日期
COMMENT ON COLUMN generated_articles.published_at IS 'Publication date in Taiwan timezone (converted from source_published_at), format: YYYY-MM-DD';
