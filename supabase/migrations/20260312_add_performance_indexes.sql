-- 首頁/最新頁查詢加速
CREATE INDEX IF NOT EXISTS idx_articles_published_date
  ON generated_articles(published, published_at DESC);

-- 分類頁查詢加速 (categories 是 text[] 陣列型別)
CREATE INDEX IF NOT EXISTS idx_articles_categories
  ON generated_articles USING GIN(categories);

-- 爬蟲查詢加速
CREATE INDEX IF NOT EXISTS idx_raw_articles_source_type
  ON raw_articles(source_type, created_at DESC);
