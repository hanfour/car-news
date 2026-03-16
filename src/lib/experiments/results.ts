/**
 * 實驗結果 DB 讀寫
 * Supabase CRUD + 跨實驗比較
 */

import { createServiceClient } from '@/lib/supabase'
import {
  ExperimentConfig,
  ExperimentRecord,
  ExperimentSample,
  ExperimentSummary,
  ExperimentStatus,
  ImageScoreDimensions,
} from './types'

// ============================================================
// 寫入
// ============================================================

/** 建立實驗記錄 */
export async function createExperiment(config: ExperimentConfig): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('image_experiments').insert({
    id: config.id,
    name: config.name,
    status: 'pending' as ExperimentStatus,
    config,
    baseline_experiment_id: config.baseline_experiment_id || null,
  })

  if (error) {
    throw new Error(`Failed to create experiment: ${error.message}`)
  }
}

/** 更新實驗狀態 */
export async function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
  extra?: Partial<Pick<ExperimentRecord, 'summary' | 'results' | 'total_cost_usd' | 'total_images' | 'improvement_pct' | 'started_at' | 'completed_at'>>
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('image_experiments')
    .update({ status, ...extra })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update experiment: ${error.message}`)
  }
}

/** 儲存單個樣本結果 */
export async function saveSample(
  experimentId: string,
  sample: ExperimentSample
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('image_experiment_samples').insert({
    experiment_id: experimentId,
    article_id: sample.article_id,
    article_title: sample.article_title,
    prompt_used: sample.prompt_used,
    image_url: sample.image_url,
    seed_used: sample.seed_used,
    generation_time_ms: sample.generation_time_ms,
    scores: sample.scores,
    composite_score: sample.composite_score,
    score_explanation: sample.score_explanation,
    cost_usd: sample.cost_usd,
  })

  if (error) {
    throw new Error(`Failed to save sample: ${error.message}`)
  }
}

/** 標記實驗為 promoted */
export async function promoteExperiment(id: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('image_experiments')
    .update({
      promoted: true,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to promote experiment: ${error.message}`)
  }
}

// ============================================================
// 讀取
// ============================================================

/** 取得實驗記錄 */
export async function getExperiment(id: string): Promise<ExperimentRecord | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('image_experiments')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get experiment: ${error.message}`)
  }

  return data as ExperimentRecord
}

/** 取得實驗的所有樣本 */
export async function getExperimentSamples(experimentId: string): Promise<ExperimentSample[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('image_experiment_samples')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to get samples: ${error.message}`)
  }

  return (data || []) as ExperimentSample[]
}

/** 取得最新的 promoted 實驗配置 */
export async function getPromotedConfig(): Promise<ExperimentConfig | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('image_experiments')
    .select('config')
    .eq('promoted', true)
    .order('promoted_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get promoted config: ${error.message}`)
  }

  return data?.config as ExperimentConfig || null
}

/** 列出所有實驗 */
export async function listExperiments(limit: number = 20): Promise<ExperimentRecord[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('image_experiments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list experiments: ${error.message}`)
  }

  return (data || []) as ExperimentRecord[]
}

// ============================================================
// 比較
// ============================================================

/** 計算實驗 summary */
export function computeSummary(
  samples: ExperimentSample[],
  durationMs: number
): ExperimentSummary {
  const scoredSamples = samples.filter(s => s.composite_score != null)

  if (scoredSamples.length === 0) {
    return {
      avg_composite: 0,
      avg_dimensions: {
        vehicleAccuracy: 0,
        detailFidelity: 0,
        composition: 0,
        mood: 0,
        technicalQuality: 0,
        editorialFit: 0,
      },
      std_dev: 0,
      min_score: 0,
      max_score: 0,
      total_images: samples.length,
      total_cost_usd: samples.reduce((sum, s) => sum + s.cost_usd, 0),
      duration_ms: durationMs,
    }
  }

  const scores = scoredSamples.map(s => s.composite_score!)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length

  // 各維度平均
  const dimKeys: (keyof ImageScoreDimensions)[] = [
    'vehicleAccuracy', 'detailFidelity', 'composition',
    'mood', 'technicalQuality', 'editorialFit',
  ]

  const avgDimensions = {} as ImageScoreDimensions
  for (const key of dimKeys) {
    const vals = scoredSamples
      .filter(s => s.scores != null)
      .map(s => s.scores![key])
    avgDimensions[key] = vals.length > 0
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
      : 0
  }

  return {
    avg_composite: Math.round(avg * 100) / 100,
    avg_dimensions: avgDimensions,
    std_dev: Math.round(Math.sqrt(variance) * 100) / 100,
    min_score: Math.min(...scores),
    max_score: Math.max(...scores),
    total_images: samples.length,
    total_cost_usd: Math.round(samples.reduce((sum, s) => sum + s.cost_usd, 0) * 10000) / 10000,
    duration_ms: durationMs,
  }
}

/** 比較兩個實驗 */
export function compareExperiments(
  experimentA: ExperimentRecord,
  experimentB: ExperimentRecord
): {
  a: { id: string; name: string; summary: ExperimentSummary | null }
  b: { id: string; name: string; summary: ExperimentSummary | null }
  improvement_pct: number | null
  recommendation: string
} {
  const a = { id: experimentA.id, name: experimentA.name, summary: experimentA.summary }
  const b = { id: experimentB.id, name: experimentB.name, summary: experimentB.summary }

  let improvement_pct: number | null = null
  let recommendation = 'Insufficient data to compare'

  if (a.summary && b.summary && a.summary.avg_composite > 0) {
    improvement_pct = Math.round(
      ((b.summary.avg_composite - a.summary.avg_composite) / a.summary.avg_composite) * 10000
    ) / 100

    if (improvement_pct > 5) {
      recommendation = `✓ "${b.name}" is ${improvement_pct}% better — CANDIDATE for promotion`
    } else if (improvement_pct > 0) {
      recommendation = `~ "${b.name}" is slightly better (+${improvement_pct}%) but below 5% threshold`
    } else if (improvement_pct === 0) {
      recommendation = `= No difference between experiments`
    } else {
      recommendation = `✗ "${b.name}" is ${Math.abs(improvement_pct)}% worse — keep current config`
    }
  }

  return { a, b, improvement_pct, recommendation }
}
