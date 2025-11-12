import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: '請在 Supabase Dashboard > SQL Editor 執行以下 SQL:',
    sql: `
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
    `
  })
}
