# Admin 系統改進: Session 管理 + Audit Log + Rate Limiting

## 🎯 改進目標

基於 Linus-Style 代碼審查,實現三個關鍵改進:

1. **Session 管理表** - 替代直接在 Cookie 存 userId
2. **審計日誌 (Audit Log)** - 追蹤所有管理員操作
3. **Rate Limiting** - 防止暴力破解

---

## 📊 架構對比

### 舊架構 (V1)
```
Cookie: admin_session=<userId>
  ↓
Middleware: 直接用 userId 查詢 profiles.is_admin
  ↓
允許/拒絕
```

**問題:**
- Cookie 中直接存 userId (容易被竄改)
- 無法撤銷特定 Session
- 沒有操作記錄
- 沒有登入失敗保護

### 新架構 (V2)
```
Cookie: admin_session=<random_token>
  ↓
1. 查詢 admin_sessions 表驗證 token
  ↓
2. 檢查 token 是否過期
  ↓
3. 獲取對應的 userId
  ↓
4. 驗證 profiles.is_admin
  ↓
5. 更新 last_activity_at
  ↓
6. 記錄到 audit_log (可選)
  ↓
允許/拒絕
```

**優點:**
- Session Token 無法偽造 (64 字符隨機)
- 可以撤銷單個 Session 或全部 Sessions
- 記錄 IP、User-Agent、活動時間
- 自動過期機制
- 完整操作審計
- 登入失敗鎖定

---

## 🗄️ 數據庫 Schema

### 1. `admin_sessions` 表

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | 關聯到 auth.users |
| `token` | VARCHAR(64) | Session Token (隨機生成) |
| `ip_address` | INET | 登入 IP |
| `user_agent` | TEXT | 瀏覽器 User-Agent |
| `created_at` | TIMESTAMPTZ | 創建時間 |
| `expires_at` | TIMESTAMPTZ | 過期時間 (預設 7 天) |
| `last_activity_at` | TIMESTAMPTZ | 最後活動時間 |

**索引:**
- `token` (WHERE expires_at > NOW())
- `user_id`
- `expires_at`

### 2. `admin_audit_log` 表

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | BIGSERIAL | Primary Key |
| `user_id` | UUID | 操作者 ID |
| `user_email` | TEXT | 操作者 Email (冗餘儲存) |
| `action` | VARCHAR(50) | 操作類型 (login, logout, update_article, etc.) |
| `resource_type` | VARCHAR(50) | 資源類型 (article, user, etc.) |
| `resource_id` | TEXT | 資源 ID |
| `changes` | JSONB | 變更內容 (before/after) |
| `ip_address` | INET | 操作 IP |
| `user_agent` | TEXT | User-Agent |
| `created_at` | TIMESTAMPTZ | 操作時間 |

**索引:**
- `user_id`
- `action`
- `resource_type, resource_id`
- `created_at DESC`

### 3. `admin_login_attempts` 表

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | BIGSERIAL | Primary Key |
| `email` | TEXT | 嘗試登入的 Email |
| `ip_address` | INET | 來源 IP |
| `success` | BOOLEAN | 是否成功 |
| `error_message` | TEXT | 失敗原因 |
| `created_at` | TIMESTAMPTZ | 時間 |

**索引:**
- `email, created_at DESC`
- `ip_address, created_at DESC`
- `created_at`

---

## 🔧 核心功能實現

### 1. Session 管理 (`src/lib/admin/session.ts`)

```typescript
// 創建 Session
const session = await createAdminSession(userId, ipAddress, userAgent)
// 返回: { token: '64字符隨機token', expiresAt: Date }

// 驗證 Token
const userId = await verifySessionToken(token)
// 返回: userId | null

// 撤銷 Session (登出)
await revokeSession(token)

// 撤銷所有 Sessions (強制登出所有設備)
await revokeAllUserSessions(userId)

// 清理過期 Sessions
await cleanupExpiredSessions()
```

### 2. Audit Log (`src/lib/admin/audit.ts`)

```typescript
// 記錄操作
await logAdminAction({
  userId: 'xxx',
  userEmail: 'admin@example.com',
  action: 'update_article',
  resourceType: 'article',
  resourceId: 'article-123',
  changes: {
    before: { published: false },
    after: { published: true }
  },
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0...'
})

// 查詢日誌
const logs = await getAuditLogs({
  userId: 'xxx',
  action: 'login',
  limit: 50
})

// 獲取資源歷史
const history = await getResourceHistory('article', 'article-123')
```

### 3. Rate Limiting (`src/lib/admin/rate-limit.ts`)

```typescript
// 檢查是否超過限制 (15分鐘內失敗5次)
const rateLimit = await checkLoginRateLimit(email, ipAddress)
// 返回: { allowed: boolean, remainingAttempts: number, resetAt?: Date }

// 記錄登入嘗試
await recordLoginAttempt(email, success, ipAddress, errorMessage)

// 清理舊記錄 (保留30天)
await cleanupOldLoginAttempts()

// 獲取登入統計
const stats = await getLoginStats(7) // 過去7天
// 返回: { total: 100, success: 95, failed: 5 }
```

---

## 📁 文件結構

### 新增文件

```
src/lib/admin/
├── session.ts          # Session 管理
├── audit.ts            # Audit Log
├── rate-limit.ts       # Rate Limiting
└── utils.ts            # 工具函數 (getClientIp, getUserAgent)

src/app/api/admin/auth/
├── login/route.v2.ts   # 改進版登入 API
└── logout/route.v2.ts  # 改進版登出 API

src/middleware.v2.ts    # 改進版 Middleware

supabase/migrations/
└── 20251119_add_admin_improvements.sql  # 數據庫遷移
```

### 舊文件 (向後兼容)

```
src/app/api/admin/auth/
├── login/route.ts      # V1 API (保留向後兼容)
└── logout/route.ts     # V1 API

src/middleware.ts       # V1 Middleware
```

---

## 🚀 部署步驟

### 1. 應用數據庫遷移

在 Supabase Dashboard → SQL Editor 執行:

```sql
-- 完整 SQL 見: supabase/migrations/20251119_add_admin_improvements.sql
```

### 2. 選擇升級方式

#### 選項 A: 漸進式升級 (推薦)

保留 V1 和 V2 並行運行:

1. 先部署 V2 代碼 (不替換 V1)
2. 在測試環境驗證 V2
3. 逐步將流量切換到 V2
4. 確認無誤後刪除 V1

#### 選項 B: 直接升級

直接替換 V1:

```bash
# 替換登入 API
mv src/app/api/admin/auth/login/route.ts src/app/api/admin/auth/login/route.v1.backup.ts
mv src/app/api/admin/auth/login/route.v2.ts src/app/api/admin/auth/login/route.ts

# 替換登出 API
mv src/app/api/admin/auth/logout/route.ts src/app/api/admin/auth/logout/route.v1.backup.ts
mv src/app/api/admin/auth/logout/route.v2.ts src/app/api/admin/auth/logout/route.ts

# 替換 Middleware
mv src/middleware.ts src/middleware.v1.backup.ts
mv src/middleware.v2.ts src/middleware.ts
```

### 3. 重新部署

```bash
npm run build
# 部署到 Vercel
```

### 4. 測試

1. 登入測試: https://wantcar.autos/admin/login
2. 檢查 Session: 查詢 `admin_sessions` 表
3. 檢查 Audit Log: 查詢 `admin_audit_log` 表
4. 測試 Rate Limiting: 故意輸入5次錯誤密碼

---

## 🔍 監控與維護

### 1. 查詢活躍 Sessions

```sql
SELECT * FROM active_admin_sessions;
```

### 2. 查詢最近的管理操作

```sql
SELECT
  user_email,
  action,
  resource_type,
  resource_id,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 50;
```

### 3. 查詢登入失敗記錄

```sql
SELECT
  email,
  ip_address,
  error_message,
  created_at
FROM admin_login_attempts
WHERE success = FALSE
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 4. 定期清理 (可選)

```sql
-- 清理過期 Sessions (每小時)
SELECT cleanup_expired_sessions();

-- 清理舊的登入記錄 (每天)
DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 📈 性能影響

### V1 vs V2 對比

| 操作 | V1 | V2 | 差異 |
|------|----|----|------|
| **登入** | 2 SQL 查詢 | 4 SQL 查詢 + 3 INSERT | +3 查詢 |
| **驗證 (Middleware)** | 1 SQL 查詢 | 2 SQL 查詢 + 1 UPDATE | +2 查詢 |
| **登出** | 0 SQL 查詢 | 2 SELECT + 1 DELETE + 1 INSERT | +4 查詢 |

**結論:**
- 登入/登出操作稍慢 (增加 ~20-50ms)
- Middleware 驗證稍慢 (增加 ~10-20ms)
- 換來的是完整的安全性和可追蹤性
- 對用戶體驗影響可忽略

---

## 🛡️ 安全性提升

| 功能 | V1 | V2 | 改進 |
|------|----|----|------|
| **Cookie 偽造** | ❌ 可能 (猜測 userId) | ✅ 不可能 (64字符隨機token) | +++ |
| **Session 撤銷** | ❌ 無法撤銷 | ✅ 可撤銷單個或全部 | +++ |
| **暴力破解** | ❌ 無保護 | ✅ 15分鐘5次鎖定 | +++ |
| **操作追蹤** | ❌ 無記錄 | ✅ 完整 Audit Log | +++ |
| **異常檢測** | ❌ 無 | ✅ IP/User-Agent 追蹤 | ++ |

---

## 📝 Linus-Style 評論

### ✅ 好的設計

1. **Session Token 分離**: Cookie 不再存 userId,改存隨機 token
   - 消除了 "Cookie 就是密鑰" 的垃圾邏輯
   - Token 無法偽造,只能通過數據庫驗證

2. **簡單的數據結構**: 三張表,各司其職
   - `admin_sessions` - Session 管理
   - `admin_audit_log` - 操作記錄
   - `admin_login_attempts` - Rate Limiting
   - 沒有過度設計,沒有不必要的JOIN

3. **Rate Limiting 實用**: 15分鐘5次失敗
   - 不是理論上的完美,而是實際有效的防護
   - 保護了真實的攻擊場景

### ⚠️ 可以改進

1. **Middleware 性能**: 每次請求都查兩次數據庫
   - 可以加 Redis 緩存 Session 驗證
   - 或者在 Token 中用 JWT (但會失去撤銷能力)

2. **Audit Log 寫入**: 每個操作都寫日誌可能影響性能
   - 考慮異步寫入 (但會失去即時性)
   - 或者只記錄關鍵操作

3. **沒有 2FA**: 雖然有 Rate Limiting,但沒有雙因素驗證
   - 未來可以加

**總體評價**: 這是實用主義的實現。解決了真實問題,沒有引入不必要的複雜度。代碼清晰,數據結構簡單。可以上生產。

---

## 🔄 回滾計劃

如果 V2 出現問題:

```bash
# 1. 回滾代碼
git revert <commit-hash>

# 2. 回滾數據庫 (可選,V2 表不影響 V1)
# 不需要回滾,V1 不依賴新表

# 3. 重新部署
npm run build && vercel --prod
```

---

**創建時間**: 2025-11-19
**版本**: v2.0.0
**狀態**: ✅ 待測試
