-- 新增 source_images 欄位：存放新聞室爬蟲收集的多張圖片
ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source_images JSONB DEFAULT '[]'::jsonb;
