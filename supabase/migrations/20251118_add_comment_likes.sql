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
