import { withTimeout } from '@/lib/utils/with-timeout'
import { classifyAIError, type ClassifiedAIError } from './errors'
import {
  embedWithProvider,
  getFallbackEmbeddingProvider,
  getPrimaryEmbeddingProvider,
  type EmbeddingProvider,
} from './embeddings'

/**
 * 在每一輪生成開始前，先確認向量嵌入服務還能用。
 *
 * 為什麼要先確認：分群與重複檢查都靠 embedding。服務掛掉時如果照常跑，
 * 會先花錢把文章生成出來，最後才在「幫新文章產生向量」那一步失敗，整篇白做。
 *
 * 結果有三種：
 * - primary：主要 provider 可用，照常運作。
 * - fallback：主要不可用但備援可用。呼叫端必須進入降級模式（向量只在記憶體內用、不寫進資料庫、
 *   不做語義重複比對），因為不同模型的向量不能互相比較。
 * - unavailable：兩者都不可用，這一輪不該開始生成。
 */
export type EmbeddingMode = 'primary' | 'fallback' | 'unavailable'

export interface EmbeddingStatus {
  mode: EmbeddingMode
  /** 這一輪實際要用的 provider；unavailable 時為 null。 */
  provider: EmbeddingProvider | null
  primaryError?: ClassifiedAIError
  fallbackError?: ClassifiedAIError
}

export interface EmbeddingHealthDeps {
  probe: (provider: EmbeddingProvider) => Promise<unknown>
  primary: EmbeddingProvider
  fallback: EmbeddingProvider | null
  sleep: (ms: number) => Promise<void>
}

const PROBE_TEXT = 'health check'
const RETRY_DELAY_MS = 500
/** 探測卡住時不能拖垮整輪：逾時視為連線問題，走一般的重試與備援流程。 */
const PROBE_TIMEOUT_MS = 15_000

function defaultDeps(): EmbeddingHealthDeps {
  return {
    probe: (provider) =>
      withTimeout(
        embedWithProvider(provider, PROBE_TEXT),
        PROBE_TIMEOUT_MS,
        `embedding:${provider}`
      ),
    primary: getPrimaryEmbeddingProvider(),
    fallback: getFallbackEmbeddingProvider(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
}

/** 探測一個 provider。暫時性錯誤（限流、5xx、連線）重試一次，額度與金鑰問題不重試。 */
async function probeProvider(
  deps: EmbeddingHealthDeps,
  provider: EmbeddingProvider
): Promise<ClassifiedAIError | null> {
  let lastError: ClassifiedAIError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await deps.probe(provider)
      return null
    } catch (error) {
      lastError = classifyAIError(error)
      const transient = ['rate_limit', 'server', 'network', 'unknown'].includes(lastError.kind)
      if (!transient) return lastError
      if (attempt === 0) await deps.sleep(RETRY_DELAY_MS)
    }
  }
  return lastError
}

export async function resolveEmbeddingMode(
  deps: EmbeddingHealthDeps = defaultDeps()
): Promise<EmbeddingStatus> {
  const primaryError = await probeProvider(deps, deps.primary)
  if (!primaryError) return { mode: 'primary', provider: deps.primary }

  if (deps.fallback) {
    const fallbackError = await probeProvider(deps, deps.fallback)
    if (!fallbackError) {
      return { mode: 'fallback', provider: deps.fallback, primaryError }
    }
    return { mode: 'unavailable', provider: null, primaryError, fallbackError }
  }

  return { mode: 'unavailable', provider: null, primaryError }
}
