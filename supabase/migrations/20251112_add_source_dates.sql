-- 為 raw_articles 增加原始發布時間欄位
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 為 generated_articles 增加來源時間欄位（最早的來源文章發布時間）
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS source_date TIMESTAMPTZ;

-- 為現有資料設定預設值（使用 scraped_at 作為後備）
UPDATE raw_articles
SET published_at = scraped_at
WHERE published_at IS NULL;

-- 為現有的 generated_articles 設定來源時間（使用 created_at 作為後備）
UPDATE generated_articles
SET source_date = created_at
WHERE source_date IS NULL;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_raw_articles_published_at ON raw_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_generated_articles_source_date ON generated_articles(source_date);
