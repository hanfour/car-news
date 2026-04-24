# ✅ Admin 系統 V2 升級完成

## 升級時間
2025-11-19

## 升級方式
選項 B: 直接升級 (V1 已備份)

---

## 🔄 文件變更

### 已升級的文件

| 文件 | V1 備份 | V2 (當前) | 狀態 |
|------|---------|-----------|------|
| `src/app/api/admin/auth/login/route.ts` | `route.v1.backup.ts` | `route.ts` | ✅ 已替換 |
| `src/app/api/admin/auth/logout/route.ts` | `route.v1.backup.ts` | `route.ts` | ✅ 已替換 |
| `src/middleware.ts` | `middleware.v1.backup.ts` | `middleware.ts` | ✅ 已替換 |

### 新增的核心庫

```
src/lib/admin/
├── session.ts       ✅ Session 管理
├── audit.ts         ✅ Audit Log
├── rate-limit.ts    ✅ Rate Limiting
└── utils.ts         ✅ 工具函數
```

### 數據庫遷移 (待執行)

```
supabase/migrations/
└── 20251119_add_admin_improvements.sql  ⚠️ 需要在 Supabase 執行
```

---

## ⚠️ 下一步: 應用數據庫遷移

### 必須執行的步驟

#### 1. 打開 Supabase Dashboard

訪問: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

#### 2. 執行 SQL 遷移

複製 `supabase/migrations/20251119_add_admin_improvements.sql` 的內容並執行。

或者直接執行以下 SQL:

```sql
-- ============================================
-- Admin 系統改進: Session 管理 + 操作日誌
-- ============================================

-- 1. Admin Sessions 表
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions(token) WHERE expires_at > NOW();
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- 2. Audit Log 表
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- 3. Login Attempts 表 (Rate Limiting)
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON admin_login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON admin_login_attempts(ip_address, created_at DESC);

-- 4. RLS 政策
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON admin_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only service role can access login attempts"
  ON admin_login_attempts FOR ALL
  USING (false);

-- 5. 輔助視圖
CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT
  s.id,
  s.user_id,
  p.email,
  s.ip_address,
  s.created_at,
  s.expires_at,
  s.last_activity_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM admin_sessions s
JOIN auth.users u ON s.user_id = u.id
JOIN profiles p ON s.user_id = p.id
WHERE s.expires_at > NOW()
  AND p.is_admin = TRUE
ORDER BY s.last_activity_at DESC;
```

#### 3. 驗證遷移成功

執行以下查詢確認表已創建:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_sessions', 'admin_audit_log', 'admin_login_attempts');
```

應該返回 3 個表。

---

## 🧪 測試計劃

### 1. 測試登入

1. 訪問: https://wantcar.autos/admin/login (或 http://localhost:3000/admin/login)
2. 使用 Email/Password 登入
3. 檢查是否成功跳轉到 `/admin`

### 2. 驗證 Session

在 Supabase Dashboard 執行:

```sql
SELECT * FROM admin_sessions ORDER BY created_at DESC LIMIT 5;
```

應該看到剛才的登入 session。

### 3. 驗證 Audit Log

```sql
SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10;
```

應該看到 `login` 操作記錄。

### 4. 驗證 Rate Limiting

嘗試輸入錯誤密碼 5 次,第 6 次應該返回 `429 Too Many Requests`。

```sql
SELECT * FROM admin_login_attempts ORDER BY created_at DESC LIMIT 10;
```

應該看到失敗的登入記錄。

### 5. 測試登出

點擊登出按鈕,檢查:

```sql
-- Session 應該被刪除
SELECT * FROM admin_sessions WHERE token = '<your_token>';

-- 應該有 logout 記錄
SELECT * FROM admin_audit_log WHERE action = 'logout' ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 V1 vs V2 功能對比

| 功能 | V1 | V2 |
|------|----|----|
| **Session 管理** | ❌ Cookie 直接存 userId | ✅ Random Token + Database |
| **Session 撤銷** | ❌ 無法撤銷 | ✅ 可撤銷單個或全部 |
| **Rate Limiting** | ❌ 無保護 | ✅ 15分鐘5次鎖定 |
| **Audit Log** | ❌ 無記錄 | ✅ 完整操作記錄 |
| **IP 追蹤** | ❌ 無 | ✅ 記錄 IP/User-Agent |
| **異常檢測** | ❌ 無 | ✅ 可查詢異常登入 |

---

## 🔄 如何回滾到 V1

如果 V2 出現問題,執行以下步驟回滾:

```bash
cd src/app/api/admin/auth

# 回滾登入 API
mv login/route.ts login/route.v2.ts
mv login/route.v1.backup.ts login/route.ts

# 回滾登出 API
mv logout/route.ts logout/route.v2.ts
mv logout/route.v1.backup.ts logout/route.ts

# 回滾 Middleware
cd /Users/hanfourhuang/Projects/car-news-ai
mv src/middleware.ts src/middleware.v2.ts
mv src/middleware.v1.backup.ts src/middleware.ts

# 重新編譯
npm run build
```

**注意**: V2 新增的數據庫表不影響 V1 運行,可以保留。

---

## 📁 備份文件位置

所有 V1 文件已備份:

```
src/app/api/admin/auth/login/route.v1.backup.ts
src/app/api/admin/auth/logout/route.v1.backup.ts
src/middleware.v1.backup.ts
```

**建議**: 在確認 V2 穩定運行 1-2 週後,可以刪除這些備份文件。

---

## 🎯 升級狀態

- [x] V2 代碼已部署
- [x] 編譯測試通過
- [ ] **數據庫遷移待執行** ⚠️
- [ ] 功能測試待完成
- [ ] 生產環境部署待完成

---

## 📞 需要幫助?

完整文檔:
- `docs/admin-improvements.md` - V2 改進詳細說明
- `docs/admin-setup.md` - 設置指南
- `ADMIN_SETUP_QUICKSTART.md` - 快速開始

---

**升級完成時間**: 2025-11-19
**編譯狀態**: ✅ 通過
**下一步**: 應用數據庫遷移
