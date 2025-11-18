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
