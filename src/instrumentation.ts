import { checkRequiredEnv } from './lib/env-check'
import { logger } from './lib/logger'

/**
 * Next.js 啟動 hook(server 啟動時執行一次)。
 * 用途:把環境變數缺漏在啟動 log 就攤開,取代原本「缺了到 runtime 才靜默失效」。
 * 刻意 warn-only —— 不 process.exit,避免因備援 key 缺失而弄壞正在運作的部署。
 */
export async function register() {
  // 只在 Node.js server runtime 跑一次;跳過 edge / build 掃描階段。
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { requiredMissing, recommendedMissing } = checkRequiredEnv()

  if (requiredMissing.length > 0) {
    logger.error('env.startup_check_required_missing', undefined, {
      missing: requiredMissing,
      hint: '這些缺了會導致全站失效,請確認 Vercel 環境變數。',
    })
  }
  if (recommendedMissing.length > 0) {
    logger.warn('env.startup_check_recommended_missing', {
      missing: recommendedMissing,
      hint: '這些缺了會讓部分功能靜默失效(AI 備援 / 圖片儲存 / cron 手動觸發 / SEO)。',
    })
  }
  if (requiredMissing.length === 0 && recommendedMissing.length === 0) {
    logger.info('env.startup_check_ok')
  }
}
