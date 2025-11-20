# Admin 管理後台快速設置

## ✅ 已完成

- [x] Email/Password 登入頁面 (`/admin/login`)
- [x] Admin Dashboard (`/admin`)
- [x] 基於 `profiles.is_admin` 的角色驗證
- [x] Middleware 路由保護
- [x] Cookie Session 管理 (7天)
- [x] 雙認證支持 (Bearer Token + Cookie)
- [x] 文章管理 (查看、發布/下架、刪除)

## 🚀 立即開始 (3步驟)

### 1️⃣ 應用數據庫遷移

打開 **Supabase Dashboard → SQL Editor**,執行:

```sql
-- 添加 admin 欄位
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- RLS 策略
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
```

### 2️⃣ 設置第一個 Admin

在 Supabase → SQL Editor 執行 (替換 Email):

```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';
```

### 3️⃣ 登入測試

訪問: `https://wantcar.autos/admin/login`

使用您的 Email 和密碼登入 ✅

---

## 📂 系統架構

```
登入流程:
  Email/Password → Supabase Auth → 檢查 is_admin → 設置 Cookie → 跳轉 Dashboard

路由保護:
  每次請求 /admin/* → Middleware → 驗證 Cookie → 檢查 is_admin → 允許/拒絕
```

## 🔧 管理操作

### 添加更多 Admin
```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'new-admin@example.com';
```

### 撤銷 Admin 權限
```sql
UPDATE profiles SET is_admin = FALSE WHERE email = 'remove@example.com';
```

### 查看所有 Admin
```sql
SELECT id, email, is_admin, created_at
FROM profiles
WHERE is_admin = TRUE;
```

## 📖 完整文檔

- **詳細設置**: `docs/admin-setup.md`
- **實現總結**: `docs/admin-implementation-summary.md`

## ⚠️ 安全提醒

✅ **已實現**:
- HttpOnly Cookie (防 XSS)
- SameSite=Lax (防 CSRF)
- 每次請求驗證 Admin 身份
- 雙重認證支持

🔒 **生產環境檢查**:
- [ ] 確保 `ADMIN_API_KEY` 至少 20 字符
- [ ] 檢查 Supabase RLS 策略已啟用
- [ ] 驗證 HTTPS 已啟用 (production)

---

**創建時間**: 2025-11-19
**狀態**: ✅ 可用 (已修復 Cookie 驗證邏輯)
**Build**: ✅ TypeScript 編譯通過
