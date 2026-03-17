-- ============================================================================
-- Forum Post Reports (論壇貼文檢舉)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_reports_post ON public.forum_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_reports_user ON public.forum_post_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_reports_status ON public.forum_post_reports(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_forum_post_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_forum_post_reports_updated_at
  BEFORE UPDATE ON public.forum_post_reports
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_reports_updated_at();

-- RLS
ALTER TABLE public.forum_post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create forum post reports"
  ON public.forum_post_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read forum post reports"
  ON public.forum_post_reports FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update forum post reports"
  ON public.forum_post_reports FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);
