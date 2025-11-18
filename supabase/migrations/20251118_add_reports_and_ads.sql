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
