/**
 * 留言/論壇/社團內容的 LLM 前置過濾。
 *
 * 動機：moderateContent() 雖然已經切到 Gemini Flash 大幅降低成本，
 * 但每筆使用者寫入仍要打一次 LLM。對於明顯垃圾（LINE 廣告、超多 URL、
 * 詐騙關鍵字）或明顯無攻擊面（極短內容）的情況，可以在本地用 regex
 * 直接決定，連 LLM call 都省掉。
 *
 * 設計原則：**寧可漏判（defer to LLM）也不要誤殺正常使用者**。
 * - 規則嚴格，不模糊匹配。
 * - 任何不確定 → defer，由 LLM 做最終判斷。
 * - 一般車友留言（含對車型、品牌、價格的討論）不該被本層攔截。
 */

export interface PreFilterResult {
  decision: 'pass' | 'block' | 'defer'
  /** 命中規則時的標籤，方便 logging / 觀察誤殺率 */
  reason?: string
}

// LINE ID 索取：必須同時出現「加 / 私 / 聯絡」動作詞 + LINE 關鍵字 + 後續 ID-like token，
// 才算明顯廣告。單純提到 "LINE"（如「我用 LINE 跟朋友討論」）不該被擋。
// (?:我|您|你)? 允許「私我 line」這種帶受詞的口語形式
const LINE_SOLICIT_PATTERN =
  /(加|私|聯絡|加入)\s*(?:我|您|你)?\s*(?:line|賴|LINE|line@|賴ㄟ).{0,12}[:：@＠]?\s*[\w._-]{3,}/i

// 詐騙/吸金關鍵詞 — 都是極特定組合，不會出現在正常車聞討論裡
const SCAM_PATTERNS: ReadonlyArray<RegExp> = [
  /日賺\s*\d?\s*[萬万]/, // 日賺萬元 / 日賺3萬
  /穩賺不賠/,
  /保證獲利/,
  /(加我|私我).{0,8}(賺|獲利|投資|報明牌|帶單)/,
  /無風險.{0,5}投資/,
  /高報酬.{0,5}保證/,
]

const URL_PATTERN = /https?:\/\/[^\s]+/g
const MAX_URLS_BEFORE_BLOCK = 3 // 論壇貼文合理會有 1-2 連結（來源、相關文章），3 條以上才視為可疑

// 太短內容沒有攻擊面，且 Gemini 本來也很難判斷；直接放行
const TRIVIAL_PASS_THRESHOLD = 3

export function preFilterContent(content: string): PreFilterResult {
  const trimmed = content.trim()

  // ---- Trivial pass ----
  if (trimmed.length < TRIVIAL_PASS_THRESHOLD) {
    return { decision: 'pass', reason: 'too-short' }
  }

  // ---- Trivial block ----
  if (LINE_SOLICIT_PATTERN.test(content)) {
    return { decision: 'block', reason: 'line-solicit' }
  }

  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(content)) {
      return { decision: 'block', reason: `scam:${pattern.source.slice(0, 20)}` }
    }
  }

  const urlMatches = content.match(URL_PATTERN)
  if (urlMatches && urlMatches.length >= MAX_URLS_BEFORE_BLOCK) {
    return { decision: 'block', reason: `too-many-urls:${urlMatches.length}` }
  }

  // ---- 其他 → 交給 LLM ----
  return { decision: 'defer' }
}
