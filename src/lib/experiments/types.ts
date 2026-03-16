/**
 * 圖片生成實驗系統 — 型別定義
 */

// ============================================================
// 實驗配置
// ============================================================

export interface PromptTemplate {
  /** 視覺描述放置位置 */
  visual_description_position: 'prefix' | 'inline' | 'suffix'
  /** prompt 前綴 */
  prefix: string
  /** prompt 後綴 */
  suffix: string
  /** prompt 最大字數 */
  max_prompt_words: number
}

export interface ExperimentParams {
  /** Flux guidance_scale (1-20) */
  guidance_scale: number
  /** Flux inference steps (10-50) */
  num_inference_steps: number
  /** Gemini prompt 生成溫度 (0.0-1.0) */
  gemini_temperature: number
  /** prompt 模板配置 */
  prompt_template: PromptTemplate
  /** 固定 seed 確保可重現 */
  seed?: number
}

export interface ExperimentBudget {
  /** 最大生成圖片數 */
  max_images: number
  /** 最大花費 (USD) */
  max_cost_usd: number
}

export interface ExperimentConfig {
  id: string
  name: string
  params: ExperimentParams
  budget: ExperimentBudget
  /** 對照基準實驗 ID */
  baseline_experiment_id?: string
}

// ============================================================
// 評分系統
// ============================================================

export interface ImageScoreDimensions {
  /** 車輛是否符合描述？車型、比例、特徵正確？ */
  vehicleAccuracy: number
  /** 具體設計元素是否存在？ */
  detailFidelity: number
  /** 專業構圖、乾淨背景、無文字殘留？ */
  composition: number
  /** 氛圍是否符合新聞文章？ */
  mood: number
  /** 清晰度、光線、無 AI 痕跡？ */
  technicalQuality: number
  /** 能否作為新聞封面圖使用？ */
  editorialFit: number
}

export interface ImageScore {
  dimensions: ImageScoreDimensions
  composite: number
  explanation: string
}

// ============================================================
// 實驗結果
// ============================================================

export interface ExperimentSample {
  article_id: string
  article_title: string
  prompt_used: string
  image_url: string | null
  seed_used: number | null
  generation_time_ms: number
  scores: ImageScoreDimensions | null
  composite_score: number | null
  score_explanation: string | null
  cost_usd: number
}

export interface ExperimentSummary {
  avg_composite: number
  avg_dimensions: ImageScoreDimensions
  std_dev: number
  min_score: number
  max_score: number
  total_images: number
  total_cost_usd: number
  duration_ms: number
}

export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ExperimentRecord {
  id: string
  name: string
  status: ExperimentStatus
  config: ExperimentConfig
  results: ExperimentSample[] | null
  summary: ExperimentSummary | null
  total_cost_usd: number
  total_images: number
  baseline_experiment_id: string | null
  improvement_pct: number | null
  promoted: boolean
  promoted_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface TestArticle {
  id: string
  title: string
  content: string
  brands: string[]
}

// ============================================================
// 維度權重
// ============================================================

export const SCORE_WEIGHTS: Record<keyof ImageScoreDimensions, number> = {
  vehicleAccuracy: 0.30,
  detailFidelity: 0.20,
  composition: 0.15,
  mood: 0.10,
  technicalQuality: 0.15,
  editorialFit: 0.10,
}

/** 計算加權 composite 分數 */
export function computeComposite(dimensions: ImageScoreDimensions): number {
  let score = 0
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    score += dimensions[key as keyof ImageScoreDimensions] * weight
  }
  return Math.round(score * 100) / 100
}
