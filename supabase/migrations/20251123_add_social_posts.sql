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
