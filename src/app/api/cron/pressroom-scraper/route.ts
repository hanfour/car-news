/**
 * 官方 Pressroom 爬蟲 Cron Job
 *
 * 定時從各品牌官方新聞室爬取新聞稿和高畫質圖片
 *
 * 排程建議：每 6 小時執行一次
 * Cron: 0 0,6,12,18 * * *
 */

import { NextRequest, NextResponse } from 'next/server'
import { scrapeAllPressrooms, getSupportedBrands } from '@/lib/scrapers/pressroom'

// Vercel Cron 需要的 config
export const runtime = 'nodejs'
export const maxDuration = 300  // 5 分鐘超時

const CRON_SECRET = process.env.CRON_SECRET

/**
 * GET /api/cron/pressroom-scraper
 *
 * 執行官方 Pressroom 爬蟲
 */
export async function GET(request: NextRequest) {
  // 驗證 Cron Secret（Vercel Cron 會自動帶上）
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    // 也檢查 x-vercel-cron-signature（Vercel 自動 Cron）
    const vercelCron = request.headers.get('x-vercel-cron-signature')
    if (!vercelCron) {
      console.warn('[Pressroom Cron] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startTime = Date.now()
  console.log('[Pressroom Cron] Starting official pressroom scrape...')
  console.log(`[Pressroom Cron] Supported brands: ${getSupportedBrands().join(', ')}`)

  try {
    // 從 URL 參數獲取要爬取的品牌（可選）
    const url = new URL(request.url)
    const brandsParam = url.searchParams.get('brands')
    const brands = brandsParam ? brandsParam.split(',') : undefined

    // 執行爬蟲
    const { results, totalNew, totalErrors } = await scrapeAllPressrooms(brands)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('[Pressroom Cron] Scrape completed')
    console.log(`[Pressroom Cron] Duration: ${duration}s`)
    console.log(`[Pressroom Cron] New articles: ${totalNew}`)
    console.log(`[Pressroom Cron] Errors: ${totalErrors}`)

    // 格式化結果
    const summary = Object.entries(results).map(([brand, result]) => ({
      brand,
      success: result.success,
      new: result.stats.new,
      skipped: result.stats.skipped,
      failed: result.stats.failed,
      errors: result.errors.slice(0, 3),  // 只返回前 3 個錯誤
    }))

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      totalNew,
      totalErrors,
      results: summary,
    })

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error('[Pressroom Cron] Fatal error:', error)

    return NextResponse.json({
      success: false,
      duration: `${duration}s`,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * POST /api/cron/pressroom-scraper
 *
 * 手動觸發爬蟲（需要 Admin 驗證）
 */
export async function POST(request: NextRequest) {
  // 檢查 Admin API Key
  const authHeader = request.headers.get('authorization')
  const adminApiKey = process.env.ADMIN_API_KEY

  if (!adminApiKey || authHeader !== `Bearer ${adminApiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 委託給 GET 處理
  return GET(request)
}
