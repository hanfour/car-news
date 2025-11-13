-- 添加人工評分欄位到 generated_articles
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);

-- 添加索引以便快速查詢高分文章
CREATE INDEX IF NOT EXISTS idx_generated_articles_human_rating
ON generated_articles(human_rating)
WHERE human_rating IS NOT NULL;

-- 添加註釋
COMMENT ON COLUMN generated_articles.human_rating IS '人工評分 (1-5): 1=極差, 2=差, 3=普通, 4=良好, 5=優秀';
