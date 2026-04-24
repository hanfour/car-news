# 資料庫更新說明

## 需求背景

為了讓使用者看到文章的**真實來源時間**，而非 AI 生成時間，需要更新資料庫結構。

## 執行步驟

請在 Supabase Dashboard > SQL Editor 執行以下 SQL：

```sql
-- 為 raw_articles 增加原始發布時間欄位
ALTER TABLE raw_articles
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 為 generated_articles 增加來源時間欄位
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS source_date TIMESTAMPTZ;

-- 為現有資料設定預設值
UPDATE raw_articles SET published_at = scraped_at WHERE published_at IS NULL;
UPDATE generated_articles SET source_date = created_at WHERE source_date IS NULL;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_raw_articles_published_at ON raw_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_generated_articles_source_date ON generated_articles(source_date);
```

## 欄位說明

### raw_articles.published_at
- **用途**：儲存來源文章的原始發布時間（從 RSS feed 的 pubDate 取得）
- **後備值**：如果 RSS 沒有提供，使用 scraped_at

### generated_articles.source_date
- **用途**：儲存 AI 文章所參考的來源文章中，最早的發布時間
- **後備值**：如果來源沒有時間資訊，使用 created_at
- **顯示邏輯**：前端優先顯示 source_date，以避免誤導使用者

## 變更影響

### 使用者可見變更
- 文章卡片顯示的日期從「AI 生成時間」改為「來源新聞時間」
- 使用者可以看到真實的新聞發生時間，不會被 AI 生成時間誤導

### 系統行為變更
- Scraper 現在會儲存 RSS feed 的發布時間
- Generator 會計算並儲存最早的來源文章時間
- ArticleCard 優先顯示 source_date

## 驗證

執行 SQL 後，可以訪問以下 API 確認欄位已建立：

```bash
curl http://localhost:3000/api/debug/check-database
```

應該會看到所有文章都有 source_date 值。

## 回滾

如果需要回滾：

```sql
ALTER TABLE raw_articles DROP COLUMN IF EXISTS published_at;
ALTER TABLE generated_articles DROP COLUMN IF EXISTS source_date;
DROP INDEX IF EXISTS idx_raw_articles_published_at;
DROP INDEX IF EXISTS idx_generated_articles_source_date;
```
