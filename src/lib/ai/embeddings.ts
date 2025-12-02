import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

let openai: OpenAI | null = null
let gemini: GoogleGenerativeAI | null = null

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    })
  }
  return openai
}

function getGemini() {
  if (!gemini) {
    gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  }
  return gemini
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // 使用環境變量選擇 embedding 提供商
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini' // 默認使用 Gemini（免費額度更大）

  if (provider === 'gemini') {
    return generateEmbeddingWithGemini(text)
  } else {
    return generateEmbeddingWithOpenAI(text)
  }
}

async function generateEmbeddingWithGemini(text: string): Promise<number[]> {
  const gemini = getGemini()
  const model = gemini.getGenerativeModel({ model: 'text-embedding-004' })

  const result = await model.embedContent(text.slice(0, 8000))
  return result.embedding.values
}

async function generateEmbeddingWithOpenAI(text: string): Promise<number[]> {
  const client = getOpenAI()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    encoding_format: 'float'
  })

  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini'

  if (provider === 'gemini') {
    // Gemini 不支持批量 embeddings，需要逐個處理
    const embeddings: number[][] = []
    for (const text of texts) {
      const embedding = await generateEmbeddingWithGemini(text)
      embeddings.push(embedding)
    }
    return embeddings
  } else {
    const client = getOpenAI()
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts.map(t => t.slice(0, 8000)),
      encoding_format: 'float'
    })
    return response.data.map(d => d.embedding)
  }
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
    console.warn('Division by zero in cosineSimilarity - zero vectors detected')
    return 0
  }

  return dotProduct / denominator
}
