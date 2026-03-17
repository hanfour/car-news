-- 新增 source_images 欄位：存放新聞室爬蟲收集的多張圖片
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source_images JSONB DEFAULT '[]'::jsonb;

-- 為後續查詢效能建立索引（僅對有多圖的文章）
CREATE INDEX IF NOT EXISTS idx_raw_articles_has_source_images
  ON raw_articles ((jsonb_array_length(source_images) > 0))
  WHERE jsonb_array_length(source_images) > 0;
