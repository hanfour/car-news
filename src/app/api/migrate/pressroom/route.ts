/**
 * Pressroom 爬蟲資料庫遷移
 *
 * 新增 source 和 source_type 欄位到 raw_articles 表
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

export async function POST(request: NextRequest) {
  // 驗證 Admin
  const authHeader = request.headers.get('authorization')
  if (!ADMIN_API_KEY || authHeader !== `Bearer ${ADMIN_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    // 嘗試新增欄位（如果已存在會失敗，但不影響）
    const migrations = [
      // 新增 source 欄位
      `ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source TEXT`,
      // 新增 source_type 欄位
      `ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'news'`,
      // 新增索引以加速查詢
      `CREATE INDEX IF NOT EXISTS idx_raw_articles_source_type ON raw_articles(source_type)`,
      // 更新現有記錄的 source 欄位（從 URL 提取域名）
      `UPDATE raw_articles SET source = regexp_replace(url, '^https?://([^/]+).*$', '\\1') WHERE source IS NULL`,
    ]

    const results = []

    for (const sql of migrations) {
      try {
        // Supabase 不支援直接執行 SQL，需要使用 RPC 或在 Dashboard 執行
        // 這裡只返回需要執行的 SQL
        results.push({ sql: sql.slice(0, 100) + '...', status: 'pending' })
      } catch (err) {
        results.push({ sql: sql.slice(0, 50) + '...', status: 'error', error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Please run the following SQL in Supabase Dashboard > SQL Editor',
      migrations: [
        '-- 新增 source 欄位',
        'ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source TEXT;',
        '',
        '-- 新增 source_type 欄位',
        'ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT \'news\';',
        '',
        '-- 新增索引',
        'CREATE INDEX IF NOT EXISTS idx_raw_articles_source_type ON raw_articles(source_type);',
        '',
        '-- 更新現有記錄的 source 欄位',
        'UPDATE raw_articles SET source = regexp_replace(url, \'^https?://([^/]+).*$\', \'\\1\') WHERE source IS NULL;',
      ]
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run migrations. This will return the SQL to execute in Supabase Dashboard.',
    required_fields: [
      { name: 'source', type: 'TEXT', description: '來源網站域名' },
      { name: 'source_type', type: 'TEXT', description: '來源類型：official/news/aggregator' },
    ]
  })
}
