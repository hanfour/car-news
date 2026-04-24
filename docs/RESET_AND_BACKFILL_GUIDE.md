# 資料庫重置與歷史文章回溯指南

## 概述

本指南說明如何完全重置資料庫並重新爬取 2025/10/1 - 2025/11/19 的歷史文章。

**重要變更：**
- 新增 `source_published_at` 欄位儲存原始文章發布時間（UTC）
- `published_at` 欄位改為儲存台灣時區日期（YYYY-MM-DD）
- 文章發布日期以來源文章的原始時間為準

---

## 執行步驟

### 前置準備

1. **確保已備份重要數據**（如果需要）
2. **確認環境變數**（`.env.local`）已正確配置：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `ANTHROPIC_API_KEY`

### 步驟 1：執行資料庫 Migration

添加 `source_published_at` 欄位到 `raw_articles` 和 `generated_articles` 表：

```bash
# 在 Supabase Dashboard 中執行 migration
# 或使用 Supabase CLI
supabase migration up
```

Migration 文件：`supabase/migrations/20251119_add_source_published_at.sql`

### 步驟 2：完全重置資料庫

⚠️ **警告：這將刪除所有數據！**

```bash
npx tsx scripts/reset-database.ts
```

確認步驟：
1. 輸入 `RESET` 確認第一次
2. 輸入 `I UNDERSTAND` 確認第二次

這將刪除：
- 所有文章（generated_articles, raw_articles）
- 所有用戶互動（comments, likes, favorites, shares）
- 所有檢舉和廣告
- 所有用戶資料（profiles）
- 所有主題鎖（daily_topic_locks）

### 步驟 3：回溯爬取歷史文章

爬取 2025/10/1 - 2025/11/19 的文章：

```bash
npx tsx scripts/backfill-historical-articles.ts
```

**注意事項：**
- RSS Feed 通常只保留最近 30-60 天的文章
- 可能無法獲取所有 10/1 之前的文章
- 執行時間約 10-30 分鐘（視文章數量而定）

### 步驟 4：生成中文文章

運行生成器，將原始文章轉換為中文文章：

```bash
# 第一次執行
npx tsx scripts/run-generator.ts

# 如果還有文章未處理，重複執行
npx tsx scripts/run-generator.ts
```

**注意事項：**
- 每次執行最多處理 10 篇文章（避免超時）
- 需要多次執行直到所有文章處理完成
- 預估處理時間：每篇約 30-40 秒
- 總執行時間：3-5 小時（取決於文章數量）

### 步驟 5：檢查結果

檢查生成的文章是否正確使用了原始發布時間：

```bash
npx tsx scripts/check-recent-articles.ts
```

---

## 預期成本估算

**基於 1.5 個月歷史數據（10/1 - 11/19）：**

### 保守估計（每日 10 篇）
- 原始文章：450 篇
- 生成文章：約 150 篇
- **總成本：NT$2,330 - NT$3,500**

### 樂觀估計（每日 30 篇）
- 原始文章：1,350 篇
- 生成文章：約 450 篇
- **總成本：NT$6,990 - NT$8,440**

**成本組成：**
- Embedding API：$0.0001/1K tokens
- Claude 3.5 Sonnet API：$3/$15 per 1M tokens

---

## 常見問題

### Q: RSS Feed 無法獲取 10/1 的文章怎麼辦？

A: 這是正常的，大部分 RSS Feed 只保留最近 30-60 天的內容。我們只能爬取到 Feed 中現有的歷史文章。

### Q: 生成器執行很慢，如何加速？

A: 目前每次最多處理 10 篇文章（避免 Vercel 超時）。可以：
1. 多次並行執行 `run-generator.ts`（小心 API rate limits）
2. 在本地環境運行，調整 `MAX_ARTICLES_PER_RUN` 參數

### Q: 如何驗證文章的發布時間是否正確？

A: 運行檢查腳本：
```bash
npx tsx scripts/check-recent-articles.ts
```

檢查 `published_at`（台灣時區日期）是否與 `source_published_at`（UTC）對應。

### Q: 如果中途失敗了怎麼辦？

A: 腳本設計為可重複執行：
- 重複的文章會自動跳過
- 可以隨時重新運行生成器
- 不會產生重複數據

---

## 技術細節

### 時區轉換邏輯

```typescript
// 爬蟲：保存原始 UTC 時間
source_published_at: article.publishedAt?.toISOString() || null

// 生成器：UTC → 台灣時區（UTC+8）
const taiwanDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000)
published_at: taiwanDate.toISOString().split('T')[0] // YYYY-MM-DD
```

### 資料庫 Schema

**raw_articles:**
- `source_published_at`: TIMESTAMPTZ (UTC)

**generated_articles:**
- `source_published_at`: TIMESTAMPTZ (UTC，取最早的來源文章)
- `published_at`: TEXT (台灣時區日期，格式 YYYY-MM-DD)

---

## 參考文件

- 資料庫重置腳本：`scripts/reset-database.ts`
- 歷史爬取腳本：`scripts/backfill-historical-articles.ts`
- 生成器運行腳本：`scripts/run-generator.ts`
- 檢查腳本：`scripts/check-recent-articles.ts`
- Migration：`supabase/migrations/20251119_add_source_published_at.sql`
