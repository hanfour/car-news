-- 添加封面圖片功能

-- 1. 給 raw_articles 添加圖片欄位
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_credit TEXT;

-- 2. 給 generated_articles 添加封面圖欄位
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS cover_image TEXT,
ADD COLUMN IF NOT EXISTS image_credit TEXT;

-- 3. 添加註釋
COMMENT ON COLUMN raw_articles.image_url IS 'First image URL extracted from source article';
COMMENT ON COLUMN raw_articles.image_credit IS 'Source website name for image attribution';
COMMENT ON COLUMN generated_articles.cover_image IS 'Cover image URL for the article';
COMMENT ON COLUMN generated_articles.image_credit IS 'Image source attribution';
