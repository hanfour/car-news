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
