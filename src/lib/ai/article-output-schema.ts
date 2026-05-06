/**
 * 共享的文章生成輸出格式 prompt fragment 與 JSON 處理工具。
 *
 * claude.ts 與 gemini.ts 都需要 LLM 以同樣的 JSON schema 輸出（title_zh、
 * content_zh、categories、tags 等），這段 schema 定義 + 標籤提取規則原本
 * 在兩個檔案各複製一份（44 行 × 2），改一處要記得改另一處 — 是個
 * 持續的維護陷阱。集中於本檔案，由 provider 層的兩個實作共用。
 *
 * 注意：fix-categories debug route 用的是另一組（6 個分類）較簡化的規則，
 * 不在此處共用，避免「為了 DRY 把不同決策合併成一個」的反模式。
 */

/**
 * Prompt fragment：JSON 輸出格式 + 標籤/分類提取規則。
 * 由 article generation prompt 末尾插入。
 */
export const ARTICLE_OUTPUT_SCHEMA_PROMPT = `### 輸出格式（JSON）

請嚴格按照以下JSON格式輸出，不要添加任何markdown代碼塊標記：

{
  "title_zh": "15-25字的標題",
  "slug_en": "url-friendly-english-slug",
  "content_zh": "完整正文（使用markdown格式）",
  "confidence": 85,
  "quality_checks": {
    "has_data": true,
    "has_sources": true,
    "has_banned_words": false,
    "has_unverified": false,
    "structure_valid": true
  },
  "reasoning": "簡要說明為什麼這些來源可以聚合",
  "brands": ["Tesla", "BMW"],
  "car_models": ["Model 3", "X5"],
  "categories": ["新車", "產業"],
  "tags": ["電動車", "自動駕駛", "新能源", "性能測試"]
}

**標籤提取說明**：
- brands: 提取文章的**主要品牌**（最多3個，英文）。只包含內容主要討論的品牌，不要列出只是順帶提及的品牌。
- car_models: 提取具體車型名稱
- categories: 從以下選擇1-2個最符合的分類，按以下標準嚴格判斷：
  * 新車：新車型發表、上市資訊、車款改款（必須有具體新車型或改款資訊）
  * 評測：試駕報告、性能測試、車輛比較（必須有實際測試內容）
  * 電動車：電動車相關新聞、電池技術、充電設施（主要討論電動車議題）
  * 產業：車企財報、併購重組、股價薪酬、企業策略（企業經營層面）
  * 市場：銷售數據、市佔率、排行榜、消費趨勢（市場消費端數據）
  * 科技：自動駕駛、車聯網、AI應用、創新技術（前沿技術為主）
  * 政策：法規變更、補貼政策、環保標準、稅制調整（政府政策法規）
  * 安全：安全測試、召回公告、事故分析、碰撞評級（安全與召回）
  * 賽車：賽事報導、車隊動態、賽車運動（必須與競速賽事相關）

  ⚠️ 關鍵判斷標準：
  - 企業經營/股價/薪酬 → 「產業」；銷售數據/市佔率 → 「市場」
  - 補貼/法規/標準 → 「政策」；召回/碰撞測試 → 「安全」
  - 如果同時涉及多個分類，選擇最主要的1-2個
- tags: 3-5個關鍵詞標籤（繁體中文）

開始撰寫：
`

/**
 * 從 LLM 回傳的文字裡剝掉可能的 markdown 代碼塊包裝（\`\`\`json ... \`\`\`）。
 * 即使 prompt 已經要求「不要 markdown」，Claude / Gemini 仍偶爾會包，
 * 集中處理避免每個呼叫端各做一次 replace。
 */
export function stripJSONCodeBlock(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}
