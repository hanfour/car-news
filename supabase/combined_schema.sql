
-- ============================================================================
-- Migration 001: Initial Schema
-- File: 001_initial_schema.sql
-- ============================================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 來源文章表
CREATE TABLE raw_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    embedding VECTOR(1536),

    -- 索引
    CONSTRAINT chk_expires_at CHECK (expires_at > scraped_at)
);

CREATE INDEX idx_raw_articles_expires_at ON raw_articles(expires_at);
CREATE INDEX idx_raw_articles_embedding ON raw_articles USING ivfflat (embedding vector_cosine_ops);

-- 自動清理過期文章函數
CREATE OR REPLACE FUNCTION cleanup_expired_articles()
RETURNS void AS $$
BEGIN
    DELETE FROM raw_articles WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

---

-- 聚類表（臨時）
CREATE TABLE article_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_article_ids UUID[] NOT NULL,
    centroid VECTOR(1536),
    similarity_avg FLOAT NOT NULL CHECK (similarity_avg >= 0 AND similarity_avg <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- 生成文章表
CREATE TABLE generated_articles (
    id CHAR(7) PRIMARY KEY,
    cluster_id UUID REFERENCES article_clusters(id),

    -- 內容
    title_zh TEXT NOT NULL,
    content_zh TEXT NOT NULL,
    slug_en VARCHAR(200) NOT NULL,
    source_urls TEXT[] NOT NULL,

    -- 質量控制
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    quality_checks JSONB NOT NULL DEFAULT '{
        "has_data": false,
        "has_sources": false,
        "has_banned_words": false,
        "has_unverified": false,
        "structure_valid": false
    }',
    reasoning TEXT,

    -- 版本
    style_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',

    -- 發布
    published BOOLEAN NOT NULL DEFAULT false,
    published_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 統計
    view_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,

    -- 約束
    CONSTRAINT chk_published_date CHECK (published = false OR published_at IS NOT NULL),
    CONSTRAINT unique_published_slug UNIQUE (published_at, slug_en)
);

CREATE INDEX idx_generated_published ON generated_articles(published, published_at DESC) WHERE published = true;
CREATE INDEX idx_generated_published_at ON generated_articles(published_at DESC);

---

-- 每日主題鎖（防重複）
CREATE TABLE daily_topic_locks (
    date DATE NOT NULL,
    topic_hash CHAR(64) NOT NULL,
    article_id CHAR(7) REFERENCES generated_articles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, topic_hash)
);

-- 自動清理舊鎖（保留7天）
CREATE OR REPLACE FUNCTION cleanup_old_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM daily_topic_locks WHERE date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

---

-- 評論表
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) REFERENCES generated_articles(id) ON DELETE CASCADE,
    author_name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL CHECK (LENGTH(content) >= 1 AND LENGTH(content) <= 2000),

    -- AI審核
    ai_moderation JSONB NOT NULL DEFAULT '{
        "passed": false,
        "confidence": 0,
        "flags": []
    }',
    visible BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_article_visible ON comments(article_id, visible, created_at DESC);

---

-- 分享事件表
CREATE TABLE share_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) REFERENCES generated_articles(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'line', 'copy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_events_article ON share_events(article_id, platform, created_at);

---

-- 風格配置表（版本管理）
CREATE TABLE style_configs (
    version VARCHAR(10) PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    style_guide TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 確保只有一個active配置
CREATE UNIQUE INDEX idx_one_active_style ON style_configs (active) WHERE active = true;

---

-- 觸發器：發布文章時更新published_at
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) THEN
        NEW.published_at = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_published_at
BEFORE INSERT OR UPDATE ON generated_articles
FOR EACH ROW
EXECUTE FUNCTION set_published_at();

---

-- 觸發器：分享事件增加計數
CREATE OR REPLACE FUNCTION increment_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE generated_articles
    SET share_count = share_count + 1
    WHERE id = NEW.article_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_share
AFTER INSERT ON share_events
FOR EACH ROW
EXECUTE FUNCTION increment_share_count();

---

-- 視圖：已發布文章（優化查詢）
CREATE VIEW published_articles AS
SELECT
    id,
    title_zh,
    content_zh,
    slug_en,
    source_urls,
    published_at,
    view_count,
    share_count,
    created_at
FROM generated_articles
WHERE published = true
ORDER BY published_at DESC, created_at DESC;

---

-- Cron日誌表（用於監控）
CREATE TABLE cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name, status, created_at DESC);

---

-- 插入初始風格配置
INSERT INTO style_configs (version, system_prompt, style_guide, active) VALUES (
    'v1.0',
    '# 角色定義
你是一位資深汽車產業媒體人，擁有15年從業經驗。',
    '# 文章結構模板
參見 style-guide.txt',
    true
);


-- ============================================================================
-- Migration 002: Add Tags and Featured
-- File: 002_add_tags_and_featured.sql
-- ============================================================================

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


-- ============================================================================
-- Migration 003: Add Cover Images
-- File: 003_add_cover_images.sql
-- ============================================================================

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


-- ============================================================================
-- Migration 004: Add Brand and Images
-- File: 004_add_brand_and_images.sql
-- ============================================================================

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


-- ============================================================================
-- Migration 20250111: Get Popular Tags Function
-- File: 20250111_get_popular_tags_function.sql
-- ============================================================================

-- Create function to get popular tags efficiently using database aggregation
CREATE OR REPLACE FUNCTION get_popular_tags(tag_limit INT DEFAULT 30)
RETURNS TABLE (name TEXT, count BIGINT) AS $$
  SELECT
    tag as name,
    COUNT(*) as count
  FROM
    generated_articles,
    jsonb_array_elements_text(tags) as tag
  WHERE
    published = true
    AND tags IS NOT NULL
  GROUP BY tag
  ORDER BY count DESC
  LIMIT tag_limit;
$$ LANGUAGE SQL STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_popular_tags IS 'Returns the most popular tags from published articles, sorted by frequency';


-- ============================================================================
-- Migration 005: Add User System
-- File: 005_add_user_system.sql
-- ============================================================================

-- ============================================
-- 會員系統：profiles, favorites, comments
-- ============================================

-- ============================================
-- 1. 會員基礎資料表
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 所有人都可以讀取 profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- 只有本人可以更新自己的 profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 只有本人可以插入自己的 profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. 收藏功能
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_article ON public.user_favorites(article_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created ON public.user_favorites(created_at DESC);

-- RLS policies for favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- 只能看到自己的收藏
CREATE POLICY "Users can view own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- 只能新增自己的收藏
CREATE POLICY "Users can insert own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 只能刪除自己的收藏
CREATE POLICY "Users can delete own favorites"
  ON public.user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. 評論系統
-- ============================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE, -- 支援回覆
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true, -- AI 審核通過才為 true
  moderation_result JSONB, -- AI 審核結果（confidence, flags）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_comments_article ON public.comments(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON public.comments(is_approved);

-- RLS policies for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 所有人都可以看到已審核的評論
CREATE POLICY "Approved comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id);

-- 登入用戶可以新增評論
CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 只有本人可以更新自己的評論
CREATE POLICY "Users can update own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

-- 只有本人可以刪除自己的評論
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. 自動創建 profile trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 5. 統計函數：文章收藏數
-- ============================================
CREATE OR REPLACE FUNCTION get_article_favorites_count(article_id_param TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_favorites
  WHERE article_id = article_id_param;
$$ LANGUAGE sql STABLE;

-- ============================================
-- 6. 統計函數：文章評論數
-- ============================================
CREATE OR REPLACE FUNCTION get_article_comments_count(article_id_param TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.comments
  WHERE article_id = article_id_param AND is_approved = true;
$$ LANGUAGE sql STABLE;

-- ============================================
-- 7. 更新 generated_articles 增加統計欄位（可選）
-- ============================================
ALTER TABLE generated_articles
  ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- ============================================
-- 8. 統計更新 trigger（保持計數同步）
-- ============================================
CREATE OR REPLACE FUNCTION update_article_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE generated_articles
    SET favorites_count = favorites_count + 1
    WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE generated_articles
    SET favorites_count = GREATEST(0, favorites_count - 1)
    WHERE id = OLD.article_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_favorites_count ON public.user_favorites;
CREATE TRIGGER trigger_update_favorites_count
  AFTER INSERT OR DELETE ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION update_article_favorites_count();

CREATE OR REPLACE FUNCTION update_article_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_approved = true THEN
    UPDATE generated_articles
    SET comments_count = comments_count + 1
    WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_approved = true THEN
    UPDATE generated_articles
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.article_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_approved = false AND NEW.is_approved = true THEN
      UPDATE generated_articles
      SET comments_count = comments_count + 1
      WHERE id = NEW.article_id;
    ELSIF OLD.is_approved = true AND NEW.is_approved = false THEN
      UPDATE generated_articles
      SET comments_count = GREATEST(0, comments_count - 1)
      WHERE id = NEW.article_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comments_count ON public.comments;
CREATE TRIGGER trigger_update_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_article_comments_count();


-- ============================================================================
-- Migration 20251112: Add Source Dates
-- File: 20251112_add_source_dates.sql
-- ============================================================================

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


-- ============================================================================
-- Migration 20251112: Add Human Rating
-- File: 20251112_add_human_rating.sql
-- ============================================================================

-- 添加人工評分欄位到 generated_articles
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);

-- 添加索引以便快速查詢高分文章
CREATE INDEX IF NOT EXISTS idx_generated_articles_human_rating
ON generated_articles(human_rating)
WHERE human_rating IS NOT NULL;

-- 添加註釋
COMMENT ON COLUMN generated_articles.human_rating IS '人工評分 (1-5): 1=極差, 2=差, 3=普通, 4=良好, 5=優秀';


-- ============================================================================
-- Migration 20251112: View Count Function
-- File: 20251112_view_count_function.sql
-- ============================================================================

-- Atomic view count increment function
-- Priority: P0 - Fixes race condition in view counting
-- Prevents concurrent update conflicts

CREATE OR REPLACE FUNCTION increment_view_count(article_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Atomic UPDATE - no race conditions
  UPDATE public.generated_articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id AND published = true;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Add comment
COMMENT ON FUNCTION increment_view_count IS 'Atomically increments article view count. Prevents race conditions. Added 2025-01-12';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_view_count TO anon, authenticated;


-- ============================================================================
-- Migration 20251112: Fix Comments Count
-- File: 20251112_fix_comments_count.sql
-- ============================================================================

-- Fix comments_count race condition
-- Priority: P2 - Prevents incorrect count due to concurrent inserts
-- Uses COUNT(*) instead of increment to ensure accuracy

-- Replace the increment-based trigger with a count-based one
CREATE OR REPLACE FUNCTION update_article_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Always recalculate from actual count to prevent race conditions
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    -- Determine which article_id to update
    DECLARE
      target_article_id TEXT;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        target_article_id := OLD.article_id;
      ELSE
        target_article_id := NEW.article_id;
      END IF;

      -- Atomic count update - eliminates race conditions
      UPDATE generated_articles
      SET comments_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE article_id = target_article_id
          AND is_approved = true
      )
      WHERE id = target_article_id;
    END;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger remains the same, just using the fixed function
DROP TRIGGER IF EXISTS trigger_update_comments_count ON public.comments;
CREATE TRIGGER trigger_update_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_article_comments_count();

-- Add comment
COMMENT ON FUNCTION update_article_comments_count IS 'Fixed race condition by using COUNT(*) instead of increment. Ensures accurate count in concurrent scenarios. Added 2025-01-12';

-- Optional: Fix existing incorrect counts (run once)
-- Uncomment and run manually if needed:
-- UPDATE generated_articles ga
-- SET comments_count = (
--   SELECT COUNT(*)
--   FROM comments c
--   WHERE c.article_id = ga.id AND c.is_approved = true
-- );


-- ============================================================================
-- Migration 20251112: Performance Indexes
-- File: 20251112_performance_indexes.sql
-- ============================================================================

-- Performance Optimization: Add Critical Indexes
-- Priority: P0 - Must fix immediately
-- Impact: 10x query performance improvement

-- Index 1: Brand filtering with published status
-- Used by: /brand/[name] pages
CREATE INDEX IF NOT EXISTS idx_articles_brand_published
ON public.generated_articles(primary_brand, published_at DESC)
WHERE published = true;

-- Index 2: Category filtering (GIN for array search)
-- Used by: /category/[slug] pages
CREATE INDEX IF NOT EXISTS idx_articles_category
ON public.generated_articles USING GIN(categories)
WHERE published = true;

-- Index 3: Full-text search (Chinese content only)
-- Used by: /api/search
-- This replaces slow ILIKE queries with fast tsquery
-- Note: Using 'simple' dictionary for Chinese text (no stemming)
CREATE INDEX IF NOT EXISTS idx_articles_search_zh
ON public.generated_articles USING gin(
  to_tsvector('simple', coalesce(title_zh, '') || ' ' || coalesce(content_zh, ''))
);

-- Index 4: Popular articles (view_count DESC)
-- Used by: Homepage "most viewed" section
CREATE INDEX IF NOT EXISTS idx_articles_popular
ON public.generated_articles(view_count DESC NULLS LAST, published_at DESC)
WHERE published = true;

-- Index 5: Comments with approval status
-- Used by: Article detail page comments section
CREATE INDEX IF NOT EXISTS idx_comments_article_approved
ON public.comments(article_id, created_at DESC)
WHERE is_approved = true;

-- Index 6: Recent articles by published date
-- Used by: /latest page
CREATE INDEX IF NOT EXISTS idx_articles_recent
ON public.generated_articles(published_at DESC)
WHERE published = true;

-- Index 7: Tags search optimization
-- Used by: Tag cloud and tag filtering
CREATE INDEX IF NOT EXISTS idx_articles_tags
ON public.generated_articles USING GIN(tags)
WHERE published = true;

-- Analyze tables to update statistics
ANALYZE public.generated_articles;
ANALYZE public.comments;

-- Add helpful comments
COMMENT ON INDEX idx_articles_brand_published IS 'Optimizes brand page queries - added 2025-11-13';
COMMENT ON INDEX idx_articles_category IS 'Optimizes category page queries with GIN index - added 2025-11-13';
COMMENT ON INDEX idx_articles_search_zh IS 'Full-text search for Chinese content using simple dictionary - added 2025-11-13';
COMMENT ON INDEX idx_articles_popular IS 'Optimizes popular articles queries - added 2025-11-13';
COMMENT ON INDEX idx_comments_article_approved IS 'Optimizes approved comments retrieval - added 2025-11-13';
COMMENT ON INDEX idx_articles_recent IS 'Optimizes recent articles listing - added 2025-11-13';
COMMENT ON INDEX idx_articles_tags IS 'Optimizes tag filtering with GIN index - added 2025-11-13';


-- ============================================================================
-- Migration 20251112: Search Function
-- File: 20251112_search_function.sql
-- ============================================================================

-- Full-Text Search Function for Articles
-- Priority: P0 - Replaces slow ILIKE queries
-- Performance: O(1) index lookup vs O(n) table scan

-- Create a function for full-text search
CREATE OR REPLACE FUNCTION search_articles(search_query TEXT, result_limit INT DEFAULT 30)
RETURNS TABLE (
  id character(7),        -- Fixed: matches actual table column type
  title_zh TEXT,
  content_zh TEXT,
  published_at date,      -- Fixed: actual type is date, not TIMESTAMPTZ
  cover_image TEXT,
  categories TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.id::character(7),  -- Explicit cast to match return type
    ga.title_zh,
    ga.content_zh,
    ga.published_at::date,  -- Explicit cast to match return type
    ga.cover_image,
    ga.categories,
    -- Calculate relevance rank (title matches are weighted higher)
    (
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, '')),
        plainto_tsquery('simple', search_query)
      ) +
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '')),
        plainto_tsquery('simple', search_query)
      ) * 2
    )::REAL AS rank  -- Title matches get 2x weight
  FROM
    public.generated_articles ga
  WHERE
    ga.published = true
    AND (
      to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, ''))
      @@ plainto_tsquery('simple', search_query)
    )
  ORDER BY
    rank DESC,
    ga.published_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_articles IS 'Fast full-text search for articles using PostgreSQL tsvector. Uses "simple" dictionary for Chinese text. Added 2025-01-12';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_articles TO anon, authenticated;


-- ============================================================================
-- Migration 20251113: Fix Search Function
-- File: 20251113_fix_search_function.sql
-- ============================================================================

-- Fix search_articles function type mismatch
-- Issue: id column is character(7), not TEXT
-- Date: 2025-11-13

-- Drop existing function
DROP FUNCTION IF EXISTS search_articles(TEXT, INT);

-- Recreate with correct return types matching the actual table structure
CREATE OR REPLACE FUNCTION search_articles(search_query TEXT, result_limit INT DEFAULT 30)
RETURNS TABLE (
  id character(7),        -- Fixed: was TEXT, actual type is character(7)
  title_zh TEXT,
  content_zh TEXT,
  published_at date,      -- Fixed: actual type is date, not TIMESTAMPTZ
  cover_image TEXT,
  categories TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ga.id::character(7),  -- Explicit cast to match return type
    ga.title_zh,
    ga.content_zh,
    ga.published_at::date,  -- Explicit cast to match return type
    ga.cover_image,
    ga.categories,
    -- Calculate relevance rank (title matches are weighted higher)
    (
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, '')),
        plainto_tsquery('simple', search_query)
      ) +
      ts_rank(
        to_tsvector('simple', coalesce(ga.title_zh, '')),
        plainto_tsquery('simple', search_query)
      ) * 2
    )::REAL AS rank  -- Title matches get 2x weight
  FROM
    public.generated_articles ga
  WHERE
    ga.published = true
    AND (
      to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, ''))
      @@ plainto_tsquery('simple', search_query)
    )
  ORDER BY
    rank DESC,
    ga.published_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_articles IS 'Fast full-text search for articles using PostgreSQL tsvector. Uses "simple" dictionary for Chinese text. Fixed type mismatch - added 2025-11-13';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_articles TO anon, authenticated;


-- ============================================================================
-- Migration 20251118: Add Comment Likes
-- File: 20251118_add_comment_likes.sql
-- ============================================================================

-- ============================================
-- Comment Likes System
-- Purpose: Track user likes on comments with proper constraints
-- ============================================

-- 1. Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created ON public.comment_likes(created_at DESC);

-- 3. Add likes_count column to comments table
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 4. Function to update comment likes_count
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to keep likes_count in sync
DROP TRIGGER IF EXISTS trigger_update_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trigger_update_comment_likes_count
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- 6. RLS policies for comment_likes
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Everyone can view likes (to show like counts)
CREATE POLICY "Comment likes are viewable by everyone"
  ON public.comment_likes FOR SELECT
  USING (true);

-- Authenticated users can like comments
CREATE POLICY "Authenticated users can like comments"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes
CREATE POLICY "Users can remove own likes"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Add comment to track this feature
COMMENT ON TABLE public.comment_likes IS 'Tracks user likes on comments. Added 2025-11-18';
COMMENT ON FUNCTION update_comment_likes_count IS 'Keeps comment likes_count in sync with actual likes. Added 2025-11-18';


-- ============================================================================
-- Migration 20251118: Add Article Likes
-- File: 20251118_add_article_likes.sql
-- ============================================================================

-- ============================================
-- Article Likes System
-- Purpose: Track user likes on articles with proper constraints
-- ============================================

-- 1. Create article_likes table
CREATE TABLE IF NOT EXISTS public.article_likes (
  article_id TEXT REFERENCES public.generated_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (article_id, user_id)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_likes_article ON public.article_likes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_likes_user ON public.article_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_article_likes_created ON public.article_likes(created_at DESC);

-- 3. Add likes_count column to generated_articles table
ALTER TABLE public.generated_articles
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 4. Function to update article likes_count
CREATE OR REPLACE FUNCTION update_article_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.generated_articles
    SET likes_count = likes_count + 1
    WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.generated_articles
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.article_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to keep likes_count in sync
DROP TRIGGER IF EXISTS trigger_update_article_likes_count ON public.article_likes;
CREATE TRIGGER trigger_update_article_likes_count
  AFTER INSERT OR DELETE ON public.article_likes
  FOR EACH ROW EXECUTE FUNCTION update_article_likes_count();

-- 6. RLS policies for article_likes
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

-- Everyone can view likes (to show like counts)
CREATE POLICY "Article likes are viewable by everyone"
  ON public.article_likes FOR SELECT
  USING (true);

-- Authenticated users can like articles
CREATE POLICY "Authenticated users can like articles"
  ON public.article_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes
CREATE POLICY "Users can remove own likes"
  ON public.article_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Add comment to track this feature
COMMENT ON TABLE public.article_likes IS 'Tracks user likes on articles. Added 2025-11-18';
COMMENT ON FUNCTION update_article_likes_count IS 'Keeps article likes_count in sync with actual likes. Added 2025-11-18';


-- ============================================================================
-- Migration 20251118: Add Article Shares
-- File: 20251118_add_article_shares.sql
-- ============================================================================

-- ============================================
-- Article Share Tracking System
-- Purpose: Track article share counts
-- ============================================

-- 1. Add share_count column to generated_articles table
ALTER TABLE public.generated_articles
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- 2. Create article_shares table to track individual share events (optional, for analytics)
CREATE TABLE IF NOT EXISTS public.article_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT REFERENCES public.generated_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'twitter', 'line', 'instagram', 'copy')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_shares_article ON public.article_shares(article_id);
CREATE INDEX IF NOT EXISTS idx_article_shares_user ON public.article_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_article_shares_platform ON public.article_shares(platform);
CREATE INDEX IF NOT EXISTS idx_article_shares_created ON public.article_shares(created_at DESC);

-- 4. Function to update article share_count
CREATE OR REPLACE FUNCTION update_article_share_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.generated_articles
    SET share_count = share_count + 1
    WHERE id = NEW.article_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to keep share_count in sync
DROP TRIGGER IF EXISTS trigger_update_article_share_count ON public.article_shares;
CREATE TRIGGER trigger_update_article_share_count
  AFTER INSERT ON public.article_shares
  FOR EACH ROW EXECUTE FUNCTION update_article_share_count();

-- 6. RLS policies for article_shares
ALTER TABLE public.article_shares ENABLE ROW LEVEL SECURITY;

-- Everyone can view shares (for analytics)
CREATE POLICY "Article shares are viewable by everyone"
  ON public.article_shares FOR SELECT
  USING (true);

-- Anyone can record a share (authenticated or anonymous)
CREATE POLICY "Anyone can record article shares"
  ON public.article_shares FOR INSERT
  WITH CHECK (true);

-- 7. Add comments to track this feature
COMMENT ON TABLE public.article_shares IS 'Tracks individual article share events for analytics. Added 2025-11-18';
COMMENT ON COLUMN public.generated_articles.share_count IS 'Total number of times this article has been shared';
COMMENT ON FUNCTION update_article_share_count IS 'Keeps article share_count in sync with actual shares. Added 2025-11-18';


-- ============================================================================
-- Migration 20251118: Add Reports and Ads
-- File: 20251118_add_reports_and_ads.sql
-- ============================================================================

-- Migration: Add Reports and Ad Placements
-- Created: 2025-11-18

-- ============================================================================
-- 1. Article Reports (文章檢舉)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.article_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT REFERENCES public.generated_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam',           -- 垃圾內容
    'misinformation', -- 錯誤資訊
    'inappropriate',  -- 不當內容
    'copyright',      -- 侵權
    'other'           -- 其他
  )),
  description TEXT,   -- 詳細說明（選填）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_note TEXT,    -- 管理員備註
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_reports_article ON public.article_reports(article_id);
CREATE INDEX IF NOT EXISTS idx_article_reports_user ON public.article_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_article_reports_status ON public.article_reports(status);
CREATE INDEX IF NOT EXISTS idx_article_reports_created ON public.article_reports(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_article_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_article_reports_updated_at
  BEFORE UPDATE ON public.article_reports
  FOR EACH ROW EXECUTE FUNCTION update_article_reports_updated_at();

-- ============================================================================
-- 2. Comment Reports (留言檢舉)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam',           -- 垃圾內容
    'harassment',     -- 騷擾
    'hate_speech',    -- 仇恨言論
    'misinformation', -- 錯誤資訊
    'inappropriate',  -- 不當內容
    'other'           -- 其他
  )),
  description TEXT,   -- 詳細說明（選填）
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_note TEXT,    -- 管理員備註
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_user ON public.comment_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON public.comment_reports(status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_created ON public.comment_reports(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_comment_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_reports_updated_at
  BEFORE UPDATE ON public.comment_reports
  FOR EACH ROW EXECUTE FUNCTION update_comment_reports_updated_at();

-- ============================================================================
-- 3. Ad Placements (廣告版位)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- 版位名稱（如 "文章內容中間"）
  position TEXT NOT NULL CHECK (position IN (
    'article_top',      -- 文章頂部（標題下方）
    'article_middle',   -- 文章中間（自動插入）
    'article_bottom',   -- 文章底部（留言上方）
    'sidebar_top',      -- 側邊欄頂部
    'sidebar_middle',   -- 側邊欄中間
    'sidebar_bottom',   -- 側邊欄底部
    'list_top',         -- 列表頂部
    'list_inline'       -- 列表中間（每N篇插入）
  )),
  ad_code TEXT NOT NULL,           -- 廣告代碼（HTML/JS）
  enabled BOOLEAN DEFAULT true,    -- 是否啟用
  priority INTEGER DEFAULT 0,      -- 優先級（同位置多個廣告時）

  -- 顯示條件（JSON）
  conditions JSONB DEFAULT '{}'::jsonb,
  -- 範例: {"brands": ["Tesla", "BMW"], "categories": ["新車"], "exclude_articles": ["abc123"]}

  -- 列表插入設定
  list_interval INTEGER,           -- 列表每幾篇插入一次（僅 list_inline）

  -- 統計
  impressions INTEGER DEFAULT 0,   -- 曝光次數
  clicks INTEGER DEFAULT 0,        -- 點擊次數

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_placements_position ON public.ad_placements(position);
CREATE INDEX IF NOT EXISTS idx_ad_placements_enabled ON public.ad_placements(enabled);
CREATE INDEX IF NOT EXISTS idx_ad_placements_priority ON public.ad_placements(priority DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ad_placements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ad_placements_updated_at
  BEFORE UPDATE ON public.ad_placements
  FOR EACH ROW EXECUTE FUNCTION update_ad_placements_updated_at();

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

-- Article Reports: 所有人可讀，登入用戶可建立，管理員可更新
ALTER TABLE public.article_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reports"
  ON public.article_reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON public.article_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update reports"
  ON public.article_reports FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

-- Comment Reports: 同上
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comment reports"
  ON public.comment_reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comment reports"
  ON public.comment_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update comment reports"
  ON public.comment_reports FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

-- Ad Placements: 所有人可讀（前端需要），僅管理員可修改
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled ads"
  ON public.ad_placements FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage ads"
  ON public.ad_placements FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

-- ============================================================================
-- 5. Sample Data (Optional)
-- ============================================================================

-- 插入一個測試廣告（可選）
INSERT INTO public.ad_placements (name, position, ad_code, enabled, priority)
VALUES
  ('測試廣告 - 側邊欄頂部', 'sidebar_top', '<!-- 廣告代碼位置 -->', false, 0)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Migration 20251119: Add Source Published At
-- File: 20251119_add_source_published_at.sql
-- ============================================================================

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


-- ============================================================================
-- Migration 20251119: Add Admin Users
-- File: 20251119_add_admin_users.sql
-- ============================================================================

-- 添加 admin 角色到 profiles 表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 創建索引以快速查詢 admin 用戶
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- 添加 RLS 策略：只有 admin 可以查看其他 admin
CREATE POLICY "Admins can view admin status" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- 添加註釋
COMMENT ON COLUMN profiles.is_admin IS 'Whether this user has admin privileges';

-- 手動將您的帳號設為 admin（請替換為您的 email）
-- 執行後請刪除或註釋這一行
-- UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';


-- ============================================================================
-- Migration 20251119: Add Admin Improvements
-- File: 20251119_add_admin_improvements.sql
-- ============================================================================

-- ============================================
-- Admin 系統改進: Session 管理 + 操作日誌
-- ============================================

-- 1. Admin Sessions 表 (替代直接在 Cookie 存 userId)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,  -- 用於 Cookie 的 session token
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- 自動清理過期 Session 的函數
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定期清理過期 Session (可選:需要 pg_cron 擴展)
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');

-- 註釋
COMMENT ON TABLE admin_sessions IS 'Admin 登入 session 管理';
COMMENT ON COLUMN admin_sessions.token IS 'Cookie 中存儲的 session token (SHA-256 hash)';
COMMENT ON COLUMN admin_sessions.expires_at IS '過期時間 (預設 7 天)';


-- 2. Audit Log 表 (追蹤所有管理操作)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,  -- 冗餘儲存,防止用戶刪除後無法追蹤
  action VARCHAR(50) NOT NULL,  -- login, logout, update_article, delete_article, etc.
  resource_type VARCHAR(50),    -- article, user, settings, etc.
  resource_id TEXT,              -- 被操作的資源 ID
  changes JSONB,                 -- 變更內容 (before/after)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- 註釋
COMMENT ON TABLE admin_audit_log IS 'Admin 操作審計日誌';
COMMENT ON COLUMN admin_audit_log.changes IS 'JSON 格式儲存變更內容,例如: {"before": {...}, "after": {...}}';


-- 3. Login Attempts 表 (Rate Limiting / 防暴力破解)
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_login_attempts_email ON admin_login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON admin_login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_created_at ON admin_login_attempts(created_at);

-- 檢查登入失敗次數的函數 (15分鐘內失敗 5 次則鎖定)
CREATE OR REPLACE FUNCTION check_login_rate_limit(
  p_email TEXT,
  p_ip_address INET
) RETURNS BOOLEAN AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  -- 計算過去 15 分鐘內的失敗次數
  SELECT COUNT(*)
  INTO failed_count
  FROM admin_login_attempts
  WHERE (email = p_email OR ip_address = p_ip_address)
    AND success = FALSE
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- 失敗 5 次以上則鎖定
  RETURN failed_count < 5;
END;
$$ LANGUAGE plpgsql;

-- 清理舊的登入記錄 (保留 30 天)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 註釋
COMMENT ON TABLE admin_login_attempts IS 'Admin 登入嘗試記錄 (用於 rate limiting)';
COMMENT ON FUNCTION check_login_rate_limit IS '檢查是否超過登入失敗次數限制 (15分鐘內 5 次)';


-- 4. RLS 政策 (Row Level Security)

-- admin_sessions: 只有自己可以查看自己的 session
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON admin_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- admin_audit_log: 只有 admin 可以查看日誌
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- admin_login_attempts: 系統表,禁止一般查詢
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access login attempts"
  ON admin_login_attempts FOR ALL
  USING (false);  -- 禁止所有直接查詢,只能通過 service role


-- 5. 輔助函數: 記錄審計日誌
CREATE OR REPLACE FUNCTION log_admin_action(
  p_user_id UUID,
  p_user_email TEXT,
  p_action VARCHAR(50),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (
    user_id, user_email, action, resource_type, resource_id,
    changes, ip_address, user_agent
  ) VALUES (
    p_user_id, p_user_email, p_action, p_resource_type, p_resource_id,
    p_changes, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_admin_action IS '記錄 admin 操作到審計日誌';


-- 6. 輔助視圖: 活躍的 Admin Sessions
CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT
  s.id,
  s.user_id,
  p.email,
  s.ip_address,
  s.created_at,
  s.expires_at,
  s.last_activity_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM admin_sessions s
JOIN auth.users u ON s.user_id = u.id
JOIN profiles p ON s.user_id = p.id
WHERE s.expires_at > NOW()
  AND p.is_admin = TRUE
ORDER BY s.last_activity_at DESC;

COMMENT ON VIEW active_admin_sessions IS '當前活躍的 Admin Sessions';


-- 7. 初始數據清理
-- 如果您已經有舊的 sessions,可以手動清理
-- DELETE FROM admin_sessions WHERE expires_at < NOW();


-- ============================================================================
-- Migration 20251119: Admin Complete
-- File: 20251119_admin_complete.sql
-- ============================================================================

-- ============================================
-- Admin 系統完整遷移
-- 包含: 基礎 Admin + Session 管理 + Audit Log + Rate Limiting
-- ============================================

-- ============================================
-- Part 1: 基礎 Admin 角色
-- ============================================

-- 添加 admin 角色到 profiles 表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 創建索引以快速查詢 admin 用戶
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- 添加 RLS 策略：只有 admin 可以查看其他 admin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Admins can view admin status'
    ) THEN
        CREATE POLICY "Admins can view admin status" ON profiles
          FOR SELECT
          USING (
            auth.uid() = id
            OR
            EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND is_admin = TRUE
            )
          );
    END IF;
END $$;

-- 添加註釋
COMMENT ON COLUMN profiles.is_admin IS 'Whether this user has admin privileges';


-- ============================================
-- Part 2: Admin Sessions 表 (Session 管理)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,  -- 用於 Cookie 的 session token
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- 自動清理過期 Session 的函數
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 註釋
COMMENT ON TABLE admin_sessions IS 'Admin 登入 session 管理';
COMMENT ON COLUMN admin_sessions.token IS 'Cookie 中存儲的 session token (64字符隨機)';
COMMENT ON COLUMN admin_sessions.expires_at IS '過期時間 (預設 7 天)';


-- ============================================
-- Part 3: Audit Log 表 (操作審計)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,  -- 冗餘儲存,防止用戶刪除後無法追蹤
  action VARCHAR(50) NOT NULL,  -- login, logout, update_article, delete_article, etc.
  resource_type VARCHAR(50),    -- article, user, settings, etc.
  resource_id TEXT,              -- 被操作的資源 ID
  changes JSONB,                 -- 變更內容 (before/after)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- 註釋
COMMENT ON TABLE admin_audit_log IS 'Admin 操作審計日誌';
COMMENT ON COLUMN admin_audit_log.changes IS 'JSON 格式儲存變更內容,例如: {"before": {...}, "after": {...}}';


-- ============================================
-- Part 4: Login Attempts 表 (Rate Limiting)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON admin_login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON admin_login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON admin_login_attempts(created_at);

-- 檢查登入失敗次數的函數 (15分鐘內失敗 5 次則鎖定)
CREATE OR REPLACE FUNCTION check_login_rate_limit(
  p_email TEXT,
  p_ip_address INET
) RETURNS BOOLEAN AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  -- 計算過去 15 分鐘內的失敗次數
  SELECT COUNT(*)
  INTO failed_count
  FROM admin_login_attempts
  WHERE (email = p_email OR ip_address = p_ip_address)
    AND success = FALSE
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- 失敗 5 次以上則鎖定
  RETURN failed_count < 5;
END;
$$ LANGUAGE plpgsql;

-- 清理舊的登入記錄 (保留 30 天)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 註釋
COMMENT ON TABLE admin_login_attempts IS 'Admin 登入嘗試記錄 (用於 rate limiting)';
COMMENT ON FUNCTION check_login_rate_limit IS '檢查是否超過登入失敗次數限制 (15分鐘內 5 次)';


-- ============================================
-- Part 5: RLS 政策
-- ============================================

-- admin_sessions: 只有自己可以查看自己的 session
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'admin_sessions'
        AND policyname = 'Users can view their own sessions'
    ) THEN
        CREATE POLICY "Users can view their own sessions"
          ON admin_sessions FOR SELECT
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- admin_audit_log: 只有 admin 可以查看日誌
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'admin_audit_log'
        AND policyname = 'Admins can view audit log'
    ) THEN
        CREATE POLICY "Admins can view audit log"
          ON admin_audit_log FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND is_admin = TRUE
            )
          );
    END IF;
END $$;

-- admin_login_attempts: 系統表,禁止一般查詢
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'admin_login_attempts'
        AND policyname = 'Only service role can access login attempts'
    ) THEN
        CREATE POLICY "Only service role can access login attempts"
          ON admin_login_attempts FOR ALL
          USING (false);  -- 禁止所有直接查詢,只能通過 service role
    END IF;
END $$;


-- ============================================
-- Part 6: 輔助函數
-- ============================================

-- 記錄審計日誌的輔助函數
CREATE OR REPLACE FUNCTION log_admin_action(
  p_user_id UUID,
  p_user_email TEXT,
  p_action VARCHAR(50),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (
    user_id, user_email, action, resource_type, resource_id,
    changes, ip_address, user_agent
  ) VALUES (
    p_user_id, p_user_email, p_action, p_resource_type, p_resource_id,
    p_changes, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_admin_action IS '記錄 admin 操作到審計日誌';


-- ============================================
-- Part 7: 輔助視圖
-- ============================================

-- 活躍的 Admin Sessions
CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT
  s.id,
  s.user_id,
  u.email,
  s.ip_address,
  s.created_at,
  s.expires_at,
  s.last_activity_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM admin_sessions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.expires_at > NOW()
ORDER BY s.last_activity_at DESC;

COMMENT ON VIEW active_admin_sessions IS '當前活躍的 Admin Sessions';


-- ============================================
-- 完成
-- ============================================

-- 驗證遷移
DO $$
BEGIN
  RAISE NOTICE '✅ Admin 系統遷移完成!';
  RAISE NOTICE '   - profiles.is_admin 欄位已添加';
  RAISE NOTICE '   - admin_sessions 表已創建';
  RAISE NOTICE '   - admin_audit_log 表已創建';
  RAISE NOTICE '   - admin_login_attempts 表已創建';
  RAISE NOTICE '';
  RAISE NOTICE '📝 下一步:';
  RAISE NOTICE '   UPDATE profiles SET is_admin = TRUE WHERE email = ''your-email@example.com'';';
END $$;


-- ============================================================================
-- Migration 20251121: Fix Infinite Recursion
-- File: 20251121_fix_infinite_recursion.sql
-- ============================================================================

-- Fix infinite recursion in profiles RLS policy
-- The problem: policy queries profiles table while being evaluated on profiles table

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view admin status" ON profiles;

-- Create a new policy that doesn't cause recursion
-- We keep the existing "Profiles are viewable by everyone" policy which allows all SELECTs
-- This is safe because profiles don't contain sensitive data except is_admin

-- For UPDATE and INSERT, we still restrict to own profile
-- The is_admin field will be managed through service role key only

-- Add comment to document the decision
COMMENT ON TABLE profiles IS 'All profiles are publicly viewable (read-only). Updates restricted to own profile. is_admin field managed via service role only.';


-- ============================================================================
-- Migration 20251123: Add Social Posts
-- File: 20251123_add_social_posts.sql
-- ============================================================================

-- Social Posts Table
-- 用於管理待發布和已發布的社群媒體貼文

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES generated_articles(id) ON DELETE CASCADE,

  -- 平台資訊
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),

  -- 貼文內容
  content TEXT NOT NULL, -- 100-200 字摘要
  article_url TEXT NOT NULL, -- 完整文章連結

  -- 狀態管理
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'failed')),

  -- 發文結果
  posted_at TIMESTAMPTZ,
  post_url TEXT, -- 發布後的社群媒體貼文連結
  error_message TEXT, -- 錯誤訊息（如果失敗）

  -- 審核資訊
  reviewed_by UUID REFERENCES auth.users(id), -- 審核者
  reviewed_at TIMESTAMPTZ,

  -- 時間戳記
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_social_posts_article_id ON social_posts(article_id);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);

-- 複合索引：快速查詢待審核的貼文
CREATE INDEX idx_social_posts_pending ON social_posts(status, created_at DESC) WHERE status = 'pending';

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_posts_updated_at_trigger
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

-- Row Level Security
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- 只有認證用戶可以讀取
CREATE POLICY "Authenticated users can read social posts"
  ON social_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- 只有認證用戶可以新增
CREATE POLICY "Authenticated users can create social posts"
  ON social_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 只有認證用戶可以更新
CREATE POLICY "Authenticated users can update social posts"
  ON social_posts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Meta Platform Credentials Table
-- 儲存 Meta 平台的 access tokens 和設定

CREATE TABLE IF NOT EXISTS meta_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 平台
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),

  -- 認證資訊
  access_token TEXT NOT NULL, -- 長期 access token
  page_id TEXT, -- Facebook Page ID
  instagram_account_id TEXT, -- Instagram Business Account ID

  -- Token 有效性
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- 時間戳記
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每個平台只能有一個啟用的 credential
  CONSTRAINT unique_active_platform UNIQUE (platform, is_active)
);

-- 索引
CREATE INDEX idx_meta_credentials_platform ON meta_credentials(platform);
CREATE INDEX idx_meta_credentials_active ON meta_credentials(is_active, platform);

-- 自動更新 updated_at
CREATE TRIGGER meta_credentials_updated_at_trigger
  BEFORE UPDATE ON meta_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

-- Row Level Security
ALTER TABLE meta_credentials ENABLE ROW LEVEL SECURITY;

-- 只有認證用戶可以讀取
CREATE POLICY "Authenticated users can read meta credentials"
  ON meta_credentials
  FOR SELECT
  TO authenticated
  USING (true);

-- 只有認證用戶可以管理
CREATE POLICY "Authenticated users can manage meta credentials"
  ON meta_credentials
  FOR ALL
  TO authenticated
  USING (true);

COMMENT ON TABLE social_posts IS '社群媒體貼文管理表 - 儲存待審核和已發布的貼文';
COMMENT ON TABLE meta_credentials IS 'Meta 平台認證資訊 - 儲存 Facebook/Instagram/Threads 的 access tokens';


-- ============================================================================
-- Migration 20251125: Add Deduplication Fields
-- File: 20251125_add_deduplication_fields.sql
-- ============================================================================

-- Migration: Add deduplication fields to raw_articles
-- Purpose: Track which raw articles have been used in generated articles

-- Add used_in_article_id field to raw_articles
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS used_in_article_id CHAR(7) REFERENCES generated_articles(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_raw_articles_used_in
ON raw_articles(used_in_article_id)
WHERE used_in_article_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN raw_articles.used_in_article_id IS
'ID of the generated article that used this raw article. NULL means unused.';


-- ============================================================================
-- Migration 20251222: Migrate to Gemini Embedding
-- File: 20251222_migrate_to_gemini_embedding.sql
-- ============================================================================

-- Migration: Switch from OpenAI (1536-dim) to Gemini (768-dim) embeddings
-- Date: 2025-12-22
-- Reason: OpenAI API quota exceeded, Gemini is free

-- 1. Clear existing embeddings (will be regenerated with Gemini)
UPDATE raw_articles SET embedding = NULL;
UPDATE article_clusters SET centroid = NULL;

-- 2. Drop existing index (required before altering column type)
DROP INDEX IF EXISTS idx_raw_articles_embedding;

-- 3. Alter column dimensions from 1536 to 768
ALTER TABLE raw_articles
  ALTER COLUMN embedding TYPE VECTOR(768);

ALTER TABLE article_clusters
  ALTER COLUMN centroid TYPE VECTOR(768);

-- 4. Recreate index for 768-dim vectors
CREATE INDEX idx_raw_articles_embedding ON raw_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Log the migration
INSERT INTO cron_logs (job_name, status, metadata) VALUES (
  'migration',
  'success',
  '{"migration": "20251222_migrate_to_gemini_embedding", "old_dim": 1536, "new_dim": 768}'::jsonb
);


-- ============================================================================
-- Migration 20251222: Fix Published At Timestamp
-- File: 20251222_fix_published_at_timestamp.sql
-- ============================================================================

-- Fix: Change published_at from DATE to TIMESTAMPTZ to include actual time
-- This fixes the issue where all articles show "08:00" instead of real creation time

-- 1. Change column type from DATE to TIMESTAMPTZ
ALTER TABLE generated_articles
  ALTER COLUMN published_at TYPE TIMESTAMPTZ
  USING published_at::timestamptz;

-- 2. Update trigger to use NOW() instead of CURRENT_DATE
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update existing articles to use created_at time portion
-- This preserves the date but adds the actual creation time
UPDATE generated_articles
SET published_at = (published_at::date || ' ' || created_at::time)::timestamptz
WHERE published_at IS NOT NULL;


-- ============================================================================
-- Migration 20251224: Add Generator State
-- File: 20251224_add_generator_state.sql
-- ============================================================================

-- Generator State Table
-- 用於存儲 generator 的持久化狀態（如輪盤位置）

CREATE TABLE IF NOT EXISTS generator_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_generator_state_updated_at ON generator_state(updated_at);

-- RLS 政策：只有服務端可以訪問
ALTER TABLE generator_state ENABLE ROW LEVEL SECURITY;

-- 服務端可以完全訪問（使用 service_role key）
CREATE POLICY "Service role can manage generator_state"
  ON generator_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 添加註釋
COMMENT ON TABLE generator_state IS '存儲 generator 的持久化狀態，如品牌輪盤位置';
COMMENT ON COLUMN generator_state.key IS '狀態鍵名';
COMMENT ON COLUMN generator_state.value IS '狀態值（JSON格式）';
COMMENT ON COLUMN generator_state.updated_at IS '最後更新時間';


-- ============================================================================
-- Migration 20251224: Add Brands Index
-- File: 20251224_add_brands_index.sql
-- ============================================================================

-- Performance Optimization: Add GIN index for brands array
-- Used by: Related articles query (contains brands filter)

-- Index for brands array search
CREATE INDEX IF NOT EXISTS idx_articles_brands
ON public.generated_articles USING GIN(brands)
WHERE published = true;

-- Analyze to update statistics
ANALYZE public.generated_articles;

COMMENT ON INDEX idx_articles_brands IS 'Optimizes related articles query using brands array filter - added 2025-12-24';


-- ============================================================================
-- Migration 20260312: Add Performance Indexes
-- File: 20260312_add_performance_indexes.sql
-- ============================================================================

-- 首頁/最新頁查詢加速
CREATE INDEX IF NOT EXISTS idx_articles_published_date
  ON generated_articles(published, published_at DESC);

-- 分類頁查詢加速 (categories 是 text[] 陣列型別)
CREATE INDEX IF NOT EXISTS idx_articles_categories
  ON generated_articles USING GIN(categories);

-- 爬蟲查詢加速（raw_articles 按爬取時間排序）
CREATE INDEX IF NOT EXISTS idx_raw_articles_scraped_at
  ON raw_articles(scraped_at DESC);


-- ============================================================================
-- Migration 20260312: Add Threads User ID
-- File: 20260312_add_threads_user_id.sql
-- ============================================================================

-- Threads User ID 與 Instagram Account ID 是不同的
-- Threads User ID 需透過 Threads OAuth 流程取得
ALTER TABLE meta_credentials
ADD COLUMN IF NOT EXISTS threads_user_id TEXT;

COMMENT ON COLUMN meta_credentials.threads_user_id IS 'Threads User ID (separate from Instagram Account ID, obtained via Threads OAuth)';
