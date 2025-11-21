-- ============================================
-- 設置第一個 Admin 用戶
-- ============================================

-- 步驟 1: 查看所有註冊用戶
SELECT
  u.id,
  u.email,
  u.created_at,
  p.username,
  p.display_name,
  COALESCE(p.is_admin, false) as is_admin
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- 步驟 2: 通過 email 設置為 admin
-- 替換 'your-email@example.com' 為您的 Email
UPDATE profiles
SET is_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'hanfourhuang@gmail.com'
);

-- 步驟 3: 驗證設置成功
SELECT
  u.id,
  u.email,
  p.is_admin,
  p.username
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.is_admin = TRUE;

-- 如果您還沒有帳號,請先:
-- 1. 訪問網站註冊一個帳號
-- 2. 然後執行上面的 UPDATE 語句
