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
