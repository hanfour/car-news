# Car-News-AI 全面優化設計文件

**日期**: 2026-03-11
**策略**: 穩定性優先（方案 A）
**執行順序**: 效能/可靠性 → 安全 → 重構 → 清理

---

## 1. 資料庫效能優化

### 1.1 新增 PostgreSQL 索引

透過 Supabase migration 新增：

```sql
-- 首頁/最新頁查詢加速
CREATE INDEX IF NOT EXISTS idx_articles_published_date
  ON generated_articles(published, published_at DESC);

-- 分類頁查詢加速
CREATE INDEX IF NOT EXISTS idx_articles_categories
  ON generated_articles USING GIN(categories);

-- 爬蟲查詢加速
CREATE INDEX IF NOT EXISTS idx_raw_articles_source_type
  ON raw_articles(source_type, created_at DESC);
```

### 1.2 調整快取策略

| 頁面 | 現行 revalidate | 調整後 |
|------|-----------------|--------|
| 首頁 `src/app/page.tsx` | 10s | 60s |
| 分類頁 `src/app/category/[slug]/page.tsx` | 60s | 維持 60s |

搜尋 API 加 response header：`Cache-Control: public, max-age=300`

### 1.3 搜尋優化

`src/app/api/search/route.ts` 的 ILIKE fallback 限制只搜 `title_zh`，不搜整篇 `content_zh`。

---

## 2. Cron Job 可靠性強化

### 2.1 外部 API 呼叫加超時保護

| 呼叫位置 | 檔案 | 超時設定 |
|----------|------|----------|
| Embedding 生成 | `src/app/api/cron/generator/route.ts` | 每篇 15s `AbortSignal.timeout(15000)` |
| Pressroom fetch | `src/lib/scrapers/pressroom/base.ts` | 30s `AbortSignal.timeout(30000)` |
| RSS parser | `src/lib/scraper/rss-parser.ts` | timeout: `10000` → `30000` |

### 2.2 圖片下載改為並行

`src/lib/storage/image-downloader.ts` 中的 `downloadAndStoreImages()`：
- 改用 `Promise.allSettled()` 取代循序 `for` 迴圈
- 並行上限 3（避免壓垮 Supabase Storage）
- 單張失敗不影響其他圖片

### 2.3 修復 Generator 競態條件

**Raw Article 重複處理**（`src/app/api/cron/generator/route.ts`）：
- `markRawArticlesAsUsed` 加條件 `.eq('used', false)`
- 只有成功更新的才納入處理，避免兩個 job 搶同批文章

**Topic Lock**：
- 改用 `upsert` with `onConflict('topic_hash')` 取代 check-then-create

### 2.4 修復 CRON_SECRET 驗證

`src/app/api/cron/pressroom-scraper/route.ts`（及其他 cron routes）：
- CRON_SECRET 為空/undefined 時直接拒絕（fail-closed）
- 加 `.trim()` 防止空白字元問題

---

## 3. API 安全與限速

### 3.1 搜尋 API 限速

`src/app/api/search/route.ts`：
- 新增 `src/lib/utils/rate-limiter.ts`：in-memory Map + 滑動視窗
- 每 IP 每分鐘 30 次
- 超限返回 429

### 3.2 登入限速 fail-closed

`src/lib/admin/rate-limit.ts`：
- Supabase 查詢失敗時返回 `{ allowed: false }` 而非 `{ allowed: true }`

### 3.3 文章互動防重複

確認現有 DB unique constraint 運作正常，API 層面回傳適當錯誤訊息。

---

## 4. 程式碼重構

### 4.1 提取共用 auth helper

新增 `src/lib/auth.ts`：
```typescript
export async function createAuthenticatedClient(request: Request) {
  // 封裝 createServerClient + cookie 處理
  // 回傳 { supabase, userId } 或 null
}
```

修改 8 個 API route 使用此 helper：
- `articles/[id]/favorite/route.ts`
- `articles/[id]/like/route.ts`
- `articles/[id]/share/route.ts`
- `articles/[id]/report/route.ts`
- `comments/route.ts`
- `comments/[id]/like/route.ts`
- `comments/[id]/report/route.ts`
- `comments/[id]/replies/route.ts`

### 4.2 移除重複 cosineSimilarity

`src/lib/utils/advanced-deduplication.ts`：
- 刪除本地 `cosineSimilarity` 實作
- 改為 `import { cosineSimilarity } from '@/lib/ai/embeddings'`

### 4.3 Pressroom 爬蟲改為設定驅動

新增 `src/lib/scrapers/pressroom/config.ts`：
```typescript
export const pressroomConfigs: Record<string, PressroomConfig> = {
  bmw: { baseUrl: '...', selectors: { list: '...', title: '...', ... } },
  porsche: { ... },
  // ...
}
```

新增 `src/lib/scrapers/pressroom/generic-scraper.ts`：
- 單一類別接受 config 參數
- 取代 5 個重複的品牌爬蟲類別

保留 `base.ts` 中的通用邏輯，刪除 `bmw.ts`、`porsche.ts`、`lexus-toyota.ts`、`volkswagen.ts`、`kia.ts`。

### 4.4 拆分 Admin page

`src/app/admin/page.tsx`（1,052 行）拆為：
- `src/components/admin/AdminArticleList.tsx` — 文章列表與篩選
- `src/components/admin/AdminArticleEditor.tsx` — 文章編輯表單
- `src/components/admin/AdminStatusPanel.tsx` — 系統狀態面板
- `src/app/admin/page.tsx` — 只負責頂層路由和狀態

### 4.5 刪除備份檔案

- `src/middleware.v1.backup.ts`
- `src/app/api/admin/auth/logout/route.v1.backup.ts`

### 4.6 統一 API 回應格式

所有 API route 統一為：
- 成功：`{ success: true, data: ... }`
- 錯誤：`{ error: string, code?: string }`
- HTTP status code 保持語義正確（200、201、400、401、404、429、500）

---

## 5. 腳本清理與文件更新

### 5.1 腳本整合（85 → ~20）

| 整合後 | 取代腳本 | 子命令 |
|--------|---------|--------|
| `diagnose.ts` | 16 個 check-* 腳本 | articles, brands, images, duplicates, sources |
| `image-manager.ts` | 8 個 image 腳本 | audit, fix, regenerate |
| `cleanup.ts` | 8 個 cleanup/delete 腳本 | duplicates, locks, expired, motorcycle |
| `generator-cli.ts` | 6 個 generator 腳本 | run, debug, test, config |

刪除的腳本（~15 個）：
- 一次性 setup 腳本：`setup-admin.sh`、`setup-admin-user.ts`、`create-tags-function.js`
- 已完成的 migration 腳本
- `run-migration.js`、`run-user-migration.js`

### 5.2 更新 README.md

反映真實架構：
- 11 RSS 來源 + 5 Pressroom 爬蟲
- 4 個 AI 模型（Claude、OpenAI、Gemini、Flux）
- 47+ API routes
- 完整功能清單

### 5.3 更新 PROJECT_STATUS.md

- 標記所有已完成功能
- 反映 Phase 2 pressroom 進度
- 更新待辦事項

---

## 執行順序

1. **Phase 1 — 效能與可靠性**（區塊 1 + 2）
2. **Phase 2 — 安全**（區塊 3）
3. **Phase 3 — 重構**（區塊 4）
4. **Phase 4 — 清理**（區塊 5）

每個 Phase 完成後進行驗證，確保不引入回歸問題。
