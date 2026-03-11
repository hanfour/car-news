import OpenAI from 'openai'

let openai: OpenAI | null = null

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    })
  }
  return openai
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
  const apiKey = process.env.GEMINI_API_KEY!
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: 768
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embedding API error ${response.status}: ${errorText}`)
  }

  const result = await response.json()
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
