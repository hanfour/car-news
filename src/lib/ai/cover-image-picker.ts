import 'server-only'

/**
 * 從多張候選來源圖片中，用 Gemini Vision 評分挑出最相關的當封面。
 *
 * 動機：article-generator 原本只是「拿第一張有 image_url 的圖」，
 * 完全沒有主題相關性判斷 — cluster 第一篇來源的 image_url 若是
 * 廣告 banner / logo，整篇文章就配上不相關的封面。
 *
 * 設計：
 * - 平行 score 全部候選（最多 ~5 張，~5s 內完成）
 * - composite >= MIN_ACCEPTABLE_COMPOSITE 才採用
 * - 沒有合格者回 null，由呼叫端 fallback 到 AI Flux 生成
 * - 每張個別 score 用 withTimeout 包，避免拖死 cron
 */

import { scoreImage } from '@/lib/experiments/scorer'
import type { ImageScore } from '@/lib/experiments/types'
import { withTimeout, TimeoutError } from '@/lib/utils/with-timeout'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'

/** composite < 7.0 視為品質不足，丟給 AI Flux 重生 */
const MIN_ACCEPTABLE_COMPOSITE = 7.0

/** 個別圖片 scoring 的時間上限。Gemini Vision 通常 3-5s，10s 給足空間 */
const PER_IMAGE_SCORE_TIMEOUT_MS = 10_000

export interface CoverCandidate {
  url: string
  credit: string
  caption?: string
}

export interface ScoredCover extends CoverCandidate {
  composite: number
  dimensions: ImageScore['dimensions']
}

/**
 * 從候選圖片中挑出最佳封面。
 *
 * @returns 最高分且 composite >= MIN_ACCEPTABLE_COMPOSITE 的圖片；
 *          全部不合格或全部評分失敗時回 null。呼叫端應改走 AI 生成。
 */
export async function pickBestCoverImage(
  candidates: CoverCandidate[],
  articleTitle: string
): Promise<ScoredCover | null> {
  if (candidates.length === 0) return null

  // 對 source images 而言，scorer 的 prompt 雖原為 AI 圖設計，但
  // vehicleAccuracy / composition / editorialFit 三維仍能有效篩出
  // 不相關內容（例如把 Honda 廣告擋在 Tesla 文章封面之外）。
  const scoringPrompt = `Source image candidate for article: ${articleTitle}`

  const results = await Promise.allSettled(
    candidates.map(async (img) => {
      try {
        const score = await withTimeout(
          scoreImage(img.url, articleTitle, scoringPrompt),
          PER_IMAGE_SCORE_TIMEOUT_MS,
          `cover-score:${img.url.slice(0, 60)}`
        )
        return {
          ...img,
          composite: score.composite,
          dimensions: score.dimensions,
        }
      } catch (err) {
        logger.warn('image.cover_score_fail', {
          url: img.url,
          error: getErrorMessage(err),
          isTimeout: err instanceof TimeoutError,
        })
        return null
      }
    })
  )

  const scored = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((v): v is ScoredCover => v !== null)

  if (scored.length === 0) {
    logger.warn('image.cover_score_all_failed', { count: candidates.length })
    return null
  }

  scored.sort((a, b) => b.composite - a.composite)
  const best = scored[0]

  if (best.composite < MIN_ACCEPTABLE_COMPOSITE) {
    logger.info('image.cover_below_threshold', {
      bestComposite: best.composite,
      threshold: MIN_ACCEPTABLE_COMPOSITE,
      candidates: scored.length,
      bestUrl: best.url.slice(0, 80),
    })
    return null
  }

  logger.info('image.cover_picked_by_score', {
    composite: best.composite,
    vehicleAccuracy: best.dimensions.vehicleAccuracy,
    rejectedCount: scored.length - 1,
    rejectedScores: scored.slice(1).map((s) => s.composite),
  })

  return best
}
