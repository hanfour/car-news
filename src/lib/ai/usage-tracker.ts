import 'server-only'

/**
 * 紀錄 AI provider call 的 token / 成本，供 admin dashboard 的「模型用量表」聚合。
 *
 * 設計原則：
 * - **Fire-and-forget**：不阻塞 hot path。內部 await DB write 但對外 sync API，
 *   失敗只 log warn 不 throw。這條路徑出問題不該影響 article generation / moderation。
 * - 集中於本檔的 `PRICING` 表為單一定價來源，未來模型升價時改一處即可。
 * - 只記錄真正打 API 的 call。Pre-filter 命中等本地決策不寫入。
 */

import { createServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error'

export type Provider = 'claude' | 'gemini' | 'openai' | 'fal'

export type Purpose =
  | 'article_generation'
  | 'moderation'
  | 'text_generation'
  | 'vision_scoring'
  | 'image_generation'
  | 'embedding'

export interface UsageRecord {
  provider: Provider
  /** 完整 model id，例 'gemini-2.5-flash' / 'claude-3-5-haiku-20241022' */
  model?: string
  purpose: Purpose
  inputTokens?: number
  outputTokens?: number
  /** 若呼叫端能從 SDK 取得真實成本，傳這個；否則由 estimateCost() 推算 */
  costUsd?: number
  success?: boolean
  metadata?: Record<string, unknown>
}

/**
 * 各 model 的單價（USD per 1M tokens）。
 * 來源：各 provider 官網 2026-06 定價，更動時集中改這。
 *
 * 圖片生成走 perImage，沒有 input/output。
 */
const PRICING: Record<string, { input?: number; output?: number; perImage?: number }> = {
  // ---- Claude ----
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },

  // ---- Gemini ----
  // 註：先前誤用 Gemini 1.5 Flash 舊價（0.075/0.3）與舊 embedding 價（0.025），
  // 導致 dashboard 成本被低估約 4~8 倍。以下為 2026-06 官方現價。
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-embedding-001': { input: 0.15 },

  // ---- OpenAI ----
  'gpt-4o': { input: 2.5, output: 10.0 },
  'text-embedding-3-small': { input: 0.02 },

  // ---- fal.ai (image gen) ----
  'flux-pro-1.1': { perImage: 0.008 },
  'flux-pro': { perImage: 0.008 },
}

/**
 * 依 model + tokens 推算成本（USD）。模型未在 PRICING 表中時回 0。
 */
export function estimateCost(
  model: string | undefined,
  inputTokens?: number,
  outputTokens?: number
): number {
  if (!model) return 0
  const rate = PRICING[model]
  if (!rate) return 0

  if (rate.perImage !== undefined) return rate.perImage

  const input = ((inputTokens ?? 0) / 1_000_000) * (rate.input ?? 0)
  const output = ((outputTokens ?? 0) / 1_000_000) * (rate.output ?? 0)
  return input + output
}

/**
 * 非同步寫入 ai_usage_logs。Fire-and-forget — 失敗不 throw。
 *
 * 用法：
 *   recordAIUsage({ provider: 'gemini', model: 'gemini-2.5-flash',
 *                   purpose: 'article_generation', inputTokens: 1234, outputTokens: 567 })
 *
 * 不需 await（也不該 await）— 若 DB 失敗，只在 logger 留 warn。
 */
export function recordAIUsage(record: UsageRecord): void {
  void writeUsage(record).catch((err) => {
    logger.warn('ai.usage.record_fail', { error: getErrorMessage(err) })
  })
}

async function writeUsage(record: UsageRecord): Promise<void> {
  const cost =
    record.costUsd !== undefined
      ? record.costUsd
      : estimateCost(record.model, record.inputTokens, record.outputTokens)

  const supabase = createServiceClient()
  const { error } = await supabase.from('ai_usage_logs').insert({
    provider: record.provider,
    model: record.model ?? null,
    purpose: record.purpose,
    input_tokens: record.inputTokens ?? null,
    output_tokens: record.outputTokens ?? null,
    cost_usd: cost,
    success: record.success ?? true,
    metadata: record.metadata ?? null,
  })

  if (error) {
    throw new Error(`ai_usage_logs insert failed: ${error.message}`)
  }
}
