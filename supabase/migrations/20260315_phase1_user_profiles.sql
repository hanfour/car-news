-- Phase 1: 使用者個人頁面 - profiles 表擴充
-- 新增欄位：website, location, cover_image_url, is_favorites_public

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_favorites_public BOOLEAN DEFAULT false;

-- username 格式限制
ALTER TABLE profiles ADD CONSTRAINT chk_username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_]{3,30}$');

-- username 索引（加速 lookup）
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
