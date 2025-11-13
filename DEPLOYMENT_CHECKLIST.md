# 🚀 部署檢查清單 (Deployment Checklist)

**項目**: car-news-ai
**最後更新**: 2025-11-13
**狀態**: ✅ 準備就緒

---

## 📋 部署前必須完成的任務

### ✅ 1. 代碼質量 (已完成)
- [x] 所有 TypeScript 錯誤已修復
- [x] 構建成功通過 (`npm run build`)
- [x] 所有安全漏洞已修復 (詳見 `SECURITY_AUDIT_REPORT.md`)
- [x] 性能優化已完成 (詳見 `OPTIMIZATION_SUMMARY.md`)

### ⚠️ 2. 環境變量配置 (需要行動)

在生產環境 (Vercel/Netlify/etc.) 設置以下環境變量：

```bash
# ⚠️ 必須生成新的安全密鑰 (64 字符)
ADMIN_API_KEY=<使用下方命令生成>

# ✓ 已有的變量 (確認已設置)
ANTHROPIC_API_KEY=<your_anthropic_key>
OPENAI_API_KEY=<your_openai_key>
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_key>
```

**生成安全的 ADMIN_API_KEY**:
```bash
openssl rand -hex 32
# 輸出示例: 7f3c8b9a2e1d4f6c8a9b3e5d7f1c4a6b8e9f2d5c7a3b1e4f6c8d9a2b5e7f1c3a
```

### ⚠️ 3. 數據庫遷移 (需要確認)

確認以下遷移已在生產數據庫執行：

```bash
# 查看需要執行的遷移
ls -la supabase/migrations/

# 應包含以下文件:
✓ 20251112_performance_indexes.sql       # 性能索引
✓ 20251112_search_function.sql           # 全文搜索函數
✓ 20251112_view_count_function.sql       # 原子性瀏覽計數
✓ 20251112_fix_comments_count.sql        # 修復評論計數
✓ 20251112_add_human_rating.sql          # 人工評分欄位
```

**執行遷移** (在 Supabase Dashboard):
1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 依序執行上述 SQL 文件
4. 驗證索引和函數已創建

### ⚠️ 4. 安全檢查 (需要驗證)

- [ ] `ADMIN_API_KEY` 已設置為安全值 (≥ 20 字符)
- [ ] 不是使用默認值 `admin-secret-key-change-me`
- [ ] API keys 未提交到 Git 倉庫
- [ ] `.env.local` 已在 `.gitignore` 中

### ✅ 5. 功能驗證 (部署後測試)

部署後執行以下測試：

```bash
# 測試 1: 首頁載入
curl https://your-domain.com/

# 測試 2: 搜索功能 (XSS 防護)
curl "https://your-domain.com/api/search?q=<script>alert('xss')</script>"
# 預期: 返回空結果，不執行腳本

# 測試 3: Admin API 認證
curl -H "Authorization: Bearer wrong_key" \
  https://your-domain.com/api/admin/articles
# 預期: 401 Unauthorized

# 測試 4: Admin API 認證成功
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://your-domain.com/api/admin/articles
# 預期: 200 OK，返回文章列表
```

---

## 🔧 部署步驟 (Vercel)

### 1. 推送代碼到 Git

```bash
git add .
git commit -m "Security fixes and performance optimization"
git push origin main
```

### 2. Vercel 部署

```bash
# 如果還沒安裝 Vercel CLI
npm i -g vercel

# 部署到生產環境
vercel --prod

# 或者直接在 Vercel Dashboard 觸發部署
```

### 3. 設置環境變量

在 Vercel Dashboard:
1. 進入項目 → Settings → Environment Variables
2. 添加 `ADMIN_API_KEY`
3. 值: 使用 `openssl rand -hex 32` 生成的密鑰
4. Scope: Production
5. 點擊 Save

### 4. 重新部署

```bash
vercel --prod
```

---

## 🔍 部署後驗證

### 1. 健康檢查

```bash
# 首頁載入
curl -I https://your-domain.com/
# 預期: HTTP/2 200

# 搜索 API
curl "https://your-domain.com/api/search?q=Tesla"
# 預期: 返回 Tesla 相關文章

# RSS Feed
curl https://your-domain.com/feed.xml
# 預期: 返回 XML feed
```

### 2. 性能檢查

```bash
# 使用 Lighthouse 測試
npx lighthouse https://your-domain.com/ --view

# 預期指標:
# - Performance: > 90
# - SEO: > 95
# - Best Practices: > 90
```

### 3. 安全檢查

```bash
# XSS 測試
curl "https://your-domain.com/api/search?q=<script>alert(1)</script>"
# 預期: 不執行腳本，返回空結果

# Admin API 未授權訪問
curl https://your-domain.com/api/admin/articles
# 預期: 401 Unauthorized

# Admin API 弱密鑰測試
curl -H "Authorization: Bearer admin" \
  https://your-domain.com/api/admin/articles
# 預期: 401 Unauthorized
```

---

## 📊 監控設置

### 1. Vercel Analytics

啟用 Vercel Analytics 監控:
- Real User Monitoring (RUM)
- Core Web Vitals
- Error Tracking

### 2. Supabase Logs

監控以下日誌:
```sql
-- 查看最近的錯誤
SELECT * FROM logs
WHERE level = 'error'
ORDER BY timestamp DESC
LIMIT 100;

-- 監控搜索性能
SELECT
  AVG(duration_ms) as avg_duration,
  COUNT(*) as request_count
FROM logs
WHERE path = '/api/search'
AND timestamp > NOW() - INTERVAL '1 hour';
```

### 3. 告警設置

設置以下告警:
- API 錯誤率 > 5%
- 響應時間 > 2s
- 數據庫 CPU > 80%
- 未授權 API 訪問嘗試 > 10/分鐘

---

## 🚨 回滾計劃

如果部署後發現問題:

### 快速回滾 (Vercel)

```bash
# 查看部署歷史
vercel ls

# 回滾到上一個版本
vercel rollback <deployment-url>
```

### 數據庫回滾

```sql
-- 刪除性能索引 (如果導致問題)
DROP INDEX IF EXISTS idx_brands_gin;
DROP INDEX IF EXISTS idx_categories_gin;

-- 刪除搜索函數 (如果導致問題)
DROP FUNCTION IF EXISTS search_articles;
```

---

## ✅ 部署完成檢查清單

部署完成後，確認以下所有項目:

- [ ] 網站可以正常訪問
- [ ] 首頁文章顯示正常
- [ ] 搜索功能正常工作
- [ ] 文章詳情頁顯示正常
- [ ] 評論功能正常
- [ ] Admin API 需要正確的認證
- [ ] XSS 攻擊被阻止
- [ ] 性能指標符合預期
- [ ] 錯誤日誌無異常
- [ ] 數據庫遷移已執行

---

## 📞 遇到問題？

### 常見問題排查

**問題 1: 應用無法啟動**
```bash
# 檢查: ADMIN_API_KEY 是否設置
echo $ADMIN_API_KEY

# 解決: 設置環境變量
export ADMIN_API_KEY=$(openssl rand -hex 32)
```

**問題 2: 搜索不返回結果**
```bash
# 檢查: 搜索函數是否存在
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'search_articles';

# 解決: 執行搜索函數遷移
psql -f supabase/migrations/20251112_search_function.sql
```

**問題 3: XSS 攻擊未被阻止**
```bash
# 檢查: DOMPurify 是否安裝
npm list dompurify

# 解決: 重新安裝
npm install dompurify @types/dompurify
```

---

## 📈 下一步優化建議

部署後可以考慮的優化:

1. **CDN 配置**: 配置 Cloudflare 或 Vercel Edge Network
2. **圖片優化**: 使用 Vercel Image Optimization
3. **緩存策略**: 配置 ISR (Incremental Static Regeneration)
4. **監控告警**: 設置 PagerDuty 或 Sentry
5. **備份策略**: 設置 Supabase 自動備份

---

**部署日期**: _待填寫_
**部署人員**: _待填寫_
**驗證人員**: _待填寫_
**狀態**: ⏳ 待部署

---

祝部署順利！🎉
