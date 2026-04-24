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
import { verifyCronAuth, verifyBearerSecret, unauthorized } from '@/lib/cron/auth'
import { logger } from '@/lib/logger'

// Vercel Cron 需要的 config
export const runtime = 'nodejs'
export const maxDuration = 300  // 5 分鐘超時

/**
 * GET /api/cron/pressroom-scraper
 *
 * 執行官方 Pressroom 爬蟲
 */
export async function GET(request: NextRequest) {
  // 驗證 Vercel Cron header 或 Bearer CRON_SECRET（timing-safe）
  if (!(await verifyCronAuth(request))) {
    logger.warn('cron.pressroom.unauthorized')
    return unauthorized()
  }

  const startTime = Date.now()
  logger.info('cron.pressroom.start', {
    supportedBrands: getSupportedBrands(),
  })

  try {
    // 從 URL 參數獲取要爬取的品牌（可選）
    const url = new URL(request.url)
    const brandsParam = url.searchParams.get('brands')
    const brands = brandsParam ? brandsParam.split(',') : undefined

    // 執行爬蟲
    const { results, totalNew, totalErrors } = await scrapeAllPressrooms(brands)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    logger.info('cron.pressroom.complete', {
      duration: `${duration}s`,
      totalNew,
      totalErrors,
    })

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
    logger.error('cron.pressroom.fatal', error, { duration: `${duration}s` })

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
  // 檢查 Admin API Key（timing-safe）
  if (!(await verifyBearerSecret(request, 'ADMIN_API_KEY'))) {
    return unauthorized()
  }

  // 委託給 GET 處理
  return GET(request)
}
