import { getErrorMessage } from '@/lib/utils/error'
import { stripJSONCodeBlock } from './article-output-schema'

/**
 * 處理 Claude 回應的純函式。
 *
 * 較新的 Claude 模型預設會先思考，回應的 content 第一個區塊常常是 thinking 而不是 text。
 * 過去只讀 content[0]，結果把它當成空字串，之後在 JSON.parse 失敗，備援形同虛設。
 */
export interface ContentBlockLike {
  type: string
  text?: unknown
}

export interface ClaudeResponseLike {
  stop_reason?: string | null
  content: readonly ContentBlockLike[]
}

/** 取出所有文字區塊並串接，忽略 thinking 等其他區塊。 */
export function extractClaudeText(content: readonly ContentBlockLike[]): string {
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
}

/**
 * 取出文字；回應被拒絕或根本沒有文字時丟出明確的錯誤，讓備援鏈能立刻換下一個 provider。
 * 結構化輸出（JSON）被 max_tokens 截斷就是壞掉，預設視為錯誤；純文字摘要可用 allowTruncated 放行。
 */
export function getClaudeTextOrThrow(
  response: ClaudeResponseLike,
  options: { allowTruncated?: boolean } = {}
): string {
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer (stop_reason=refusal)')
  }
  const text = extractClaudeText(response.content)
  if (response.stop_reason === 'max_tokens' && !options.allowTruncated) {
    throw new Error('Claude response was cut off at max_tokens before it finished')
  }
  if (!text.trim()) {
    throw new Error('Claude returned no text content')
  }
  return text
}

/**
 * 解析 Claude 回的 JSON。先剝掉 markdown 程式碼區塊，仍失敗時再取第一個 { 到最後一個 }，
 * 容忍模型在 JSON 前後多說一兩句話。都失敗就丟出最初的 SyntaxError。
 */
export function parseClaudeJson<T = unknown>(text: string): T {
  const stripped = stripJSONCodeBlock(text)
  try {
    return JSON.parse(stripped) as T
  } catch (firstError) {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as T
      } catch {
        // 取子字串也失敗，丟出最初的錯誤
      }
    }
    throw firstError
  }
}

/**
 * Claude Sonnet 5.5 預設會思考，而改寫文章與短摘要不需要，思考只會拉長時間與費用。
 * 官方文件的關閉方式是 `thinking: { type: 'between_tools' }`（`disabled` 會回 400）。
 * 只對這個模型送出；其他模型不送，維持各自的預設行為。
 */
export function claudeThinkingParams(
  model: string
): { thinking: { type: 'between_tools' } } | Record<string, never> {
  return /sonnet-5-5/i.test(model) ? { thinking: { type: 'between_tools' } } : {}
}

/** API 是否因為 thinking 參數而回 400。用來在參數不被接受時退回不帶它的請求。 */
export function isThinkingParamRejected(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return status === 400 && /thinking/i.test(getErrorMessage(error))
}
