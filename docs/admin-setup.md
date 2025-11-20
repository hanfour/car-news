# Admin 管理後台設置指南

## 架構說明

Admin 系統使用 **Supabase Auth + Role-Based Access Control**:

- ✅ 使用 Email/Password 登入 (Supabase Auth)
- ✅ 基於 `profiles.is_admin` 的角色驗證
- ✅ Cookie-based Session (7天有效期)
- ✅ 每次請求都驗證 Admin 權限
- ✅ 支持 API Bearer Token (用於 API 調用) 和 Cookie (用於 Web UI)

## 一次性設置步驟

### 1. 應用數據庫遷移

打開 **Supabase Dashboard → SQL Editor**,執行以下 SQL:

```sql
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
```

### 2. 創建第一個 Admin 用戶

#### 選項 A: 如果您已有 Supabase 帳號

在 Supabase Dashboard → SQL Editor 執行:

```sql
-- 替換為您的 Email
UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';
```

#### 選項 B: 如果還沒有帳號

1. 訪問網站並註冊一個新帳號
2. 註冊成功後,到 Supabase Dashboard → SQL Editor 執行:
   ```sql
   -- 替換為您剛註冊的 Email
   UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';
   ```

### 3. 測試登入

1. 訪問 `http://localhost:3000/admin/login` (本地) 或 `https://wantcar.autos/admin/login` (生產)
2. 使用您的 Email 和密碼登入
3. 成功後會自動跳轉到 `/admin` Dashboard

## 登入流程說明

```
用戶輸入 Email/Password
         ↓
1. Supabase Auth 驗證身份
         ↓
2. 檢查 profiles.is_admin = TRUE
         ↓
3. 設置 admin_session Cookie (userId)
         ↓
4. 跳轉到 /admin Dashboard
```

## Middleware 保護機制

每次訪問 `/admin/*` 路徑時:

1. **檢查 Cookie**: 是否有 `admin_session`
   - 沒有 → 重定向到 `/admin/login`

2. **驗證 Admin 身份**: 從數據庫查詢 `profiles.is_admin`
   - 不是 Admin → 清除 Cookie,重定向到登入頁
   - 是 Admin → 允許訪問

3. **已登入用戶訪問登入頁**:
   - 自動重定向到 `/admin` Dashboard

## API 認證方式

Admin API 支持兩種認證:

### 1. Cookie (Web UI 使用)
```typescript
fetch('/api/admin/articles', {
  credentials: 'include'  // 自動帶上 Cookie
})
```

### 2. Bearer Token (Postman/curl 使用)
```bash
curl https://wantcar.autos/api/admin/articles \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

## 文件結構

```
src/
├── middleware.ts                          # 保護 /admin 路徑
├── app/
│   ├── admin/
│   │   ├── page.tsx                      # Dashboard 主頁
│   │   └── login/page.tsx                # 登入頁 (Email/Password)
│   └── api/
│       └── admin/
│           ├── auth/
│           │   ├── login/route.ts        # 設置 session cookie
│           │   └── logout/route.ts       # 清除 cookie
│           └── articles/
│               ├── route.ts              # GET /admin/articles (列表)
│               └── [id]/route.ts         # PATCH/DELETE (更新/刪除)

supabase/
└── migrations/
    └── 20251119_add_admin_users.sql      # Admin 角色遷移
```

## 安全特性

✅ **密碼驗證**: 使用 Supabase Auth,支持密碼哈希、Email 驗證
✅ **角色驗證**: 雙重檢查 (登入時 + 每次請求)
✅ **HttpOnly Cookie**: 防止 XSS 攻擊
✅ **SameSite=Lax**: 防止 CSRF 攻擊
✅ **Session 過期**: 7天自動過期
✅ **環境變量保護**: ADMIN_API_KEY 必須至少 20 字符

## 常見問題

### Q: 登入後顯示 "Access denied"?
A: 檢查數據庫中您的帳號 `is_admin` 是否為 `TRUE`:
```sql
SELECT email, is_admin FROM profiles WHERE email = 'your-email@example.com';
```

### Q: 如何添加更多 Admin 用戶?
A: 在 Supabase Dashboard → SQL Editor 執行:
```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'another-admin@example.com';
```

### Q: 如何撤銷 Admin 權限?
A: 在 Supabase Dashboard → SQL Editor 執行:
```sql
UPDATE profiles SET is_admin = FALSE WHERE email = 'remove-admin@example.com';
```

### Q: Cookie 在哪裡設置?
A: `/api/admin/auth/login` API 在驗證用戶是 Admin 後設置 `admin_session` Cookie

### Q: 為什麼不直接用 API Key?
A: API Key 任何人拿到都能用,無法區分用戶身份。基於帳號的系統更安全:
- 可以追蹤誰做了什麼操作
- 可以單獨撤銷某個用戶權限
- 支持密碼重置、Email 驗證等安全功能

## 下一步計劃

- [ ] 添加操作日誌 (Audit Log)
- [ ] 文章編輯頁面
- [ ] 批量操作 (批量發布/下架)
- [ ] Admin 用戶管理界面
- [ ] 2FA 雙因素驗證
