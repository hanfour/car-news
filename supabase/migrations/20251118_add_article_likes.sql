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
