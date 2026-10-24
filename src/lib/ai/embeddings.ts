import 'server-only'
import OpenAI from 'openai'
import { logger } from '@/lib/logger'
import { recordAIUsage } from './usage-tracker'

/** 資料庫向量欄位的維度。任何 provider 產生的向量都必須是這個長度。 */
export const EMBEDDING_DIMENSIONS = 768

export type EmbeddingProvider = 'gemini' | 'openai'

let openai: OpenAI | null = null

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }
  return openai
}

/** 主要的 embedding provider；EMBEDDING_PROVIDER 未設或為 gemini 時用 Gemini。 */
export function getPrimaryEmbeddingProvider(): EmbeddingProvider {
  return (process.env.EMBEDDING_PROVIDER || 'gemini') === 'gemini' ? 'gemini' : 'openai'
}

/**
 * 備援 embedding provider：另一家且有金鑰時才回傳，EMBEDDING_FALLBACK=off 可關閉。
 *
 * 注意：不同模型產生的向量彼此不能比較，所以備援只能用在「同一輪內自成一組」的情境
 * （見 generator 的降級模式），不能把備援向量寫進資料庫跟主要 provider 的向量混用。
 */
export function getFallbackEmbeddingProvider(): EmbeddingProvider | null {
  if (process.env.EMBEDDING_FALLBACK === 'off') return null
  const other: EmbeddingProvider = getPrimaryEmbeddingProvider() === 'gemini' ? 'openai' : 'gemini'
  const hasKey =
    other === 'openai'
      ? !!process.env.OPENAI_API_KEY?.trim()
      : !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)?.trim()
  return hasKey ? other : null
}

export async function embedWithProvider(
  provider: EmbeddingProvider,
  text: string
): Promise<number[]> {
  return provider === 'gemini'
    ? generateEmbeddingWithGemini(text)
    : generateEmbeddingWithOpenAI(text)
}

/** OpenAI 一次最多送的筆數；Gemini 沒有批次 API，一律逐筆。 */
const OPENAI_BATCH_SIZE = 64
/** 同時送出的批次數 */
const OPENAI_CONCURRENCY = 4

export async function embedManyWithProvider(
  provider: EmbeddingProvider,
  texts: string[]
): Promise<number[][]> {
  if (provider === 'gemini') {
    // Gemini 不支持批量 embeddings，需要逐個處理
    const embeddings: number[][] = []
    for (const text of texts) {
      embeddings.push(await generateEmbeddingWithGemini(text))
    }
    return embeddings
  }

  const client = getOpenAI()
  const batches: string[][] = []
  for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
    batches.push(texts.slice(i, i + OPENAI_BATCH_SIZE))
  }

  const embedBatch = async (batch: string[]): Promise<number[][]> => {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map((t) => t.slice(0, 8000)),
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: 'float',
    })
    recordAIUsage({
      provider: 'openai',
      model: 'text-embedding-3-small',
      purpose: 'embedding',
      inputTokens: response.usage?.prompt_tokens,
    })
    // API 以 index 標示對應的輸入，不假設回傳順序
    return [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
  }

  // 少量並行，兼顧速度與限流；每組內的結果順序與輸入一致。
  const embeddings: number[][] = []
  for (let i = 0; i < batches.length; i += OPENAI_CONCURRENCY) {
    const group = batches.slice(i, i + OPENAI_CONCURRENCY)
    const results = await Promise.all(group.map(embedBatch))
    for (const result of results) embeddings.push(...result)
  }
  return embeddings
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embedWithProvider(getPrimaryEmbeddingProvider(), text)
}

async function generateEmbeddingWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  const truncated = text.slice(0, 8000)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: truncated }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embedding API error ${response.status}: ${errorText}`)
  }

  const result = await response.json()

  // 粗略估 token 數：中文約 1.5 char/token，~4 char/token for English. 取保守 2 char/token
  recordAIUsage({
    provider: 'gemini',
    model: 'gemini-embedding-001',
    purpose: 'embedding',
    inputTokens: Math.ceil(truncated.length / 2),
  })

  return result.embedding.values
}

async function generateEmbeddingWithOpenAI(text: string): Promise<number[]> {
  const client = getOpenAI()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: EMBEDDING_DIMENSIONS,
    encoding_format: 'float',
  })

  recordAIUsage({
    provider: 'openai',
    model: 'text-embedding-3-small',
    purpose: 'embedding',
    inputTokens: response.usage?.prompt_tokens,
  })

  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embedManyWithProvider(getPrimaryEmbeddingProvider(), texts)
}

// 计算余弦相似度
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)

  // Prevent division by zero
  if (denominator === 0) {
    logger.warn('ai.embeddings.cosine_zero_vector')
    return 0
  }

  return dotProduct / denominator
}
