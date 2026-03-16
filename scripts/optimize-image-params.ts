/**
 * 自動化圖片生成參數優化
 *
 * 策略：逐維度搜尋最佳參數，每輪保留最佳配置
 * Round 1: Baseline（公平基準）
 * Round 2: guidance_scale（3.5, 5.0, 7.5, 10.0）
 * Round 3: inference_steps（15, 28, 40）
 * Round 4: prompt template position（prefix, inline, suffix）
 * Round 5: Gemini temperature（0.1, 0.3, 0.5, 0.7）
 * Round 6: 最終驗證
 *
 * 用法：npx tsx scripts/optimize-image-params.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { ExperimentConfig, ExperimentParams, PromptTemplate } from '@/lib/experiments/types'
import { createCustomConfig } from '@/lib/experiments/config-presets'
import { runExperiment } from '@/lib/experiments/runner'
import { getExperiment, promoteExperiment } from '@/lib/experiments/results'

interface RoundResult {
  round: string
  experimentId: string
  name: string
  score: number
  params: ExperimentParams
}

const results: RoundResult[] = []
let bestParams: Partial<ExperimentParams> = {}
let bestScore = 0
let bestId = ''

async function runAndScore(
  name: string,
  overrides: Partial<ExperimentParams>,
  baselineId?: string
): Promise<{ id: string; score: number }> {
  const config = createCustomConfig(name, overrides, baselineId)
  await runExperiment(config)
  const exp = await getExperiment(config.id)
  const score = exp?.summary?.avg_composite ?? 0
  return { id: config.id, score }
}

function logRoundSummary(round: string, variants: Array<{ name: string; score: number; id: string }>) {
  console.log('\n' + '═'.repeat(60))
  console.log(`📊 ${round} — Results`)
  console.log('═'.repeat(60))
  const sorted = [...variants].sort((a, b) => b.score - a.score)
  for (const v of sorted) {
    const marker = v.id === sorted[0].id ? ' ★ WINNER' : ''
    console.log(`   ${v.score.toFixed(2)}/10  ${v.name}${marker}`)
  }
  console.log('═'.repeat(60))
}

async function main() {
  console.log('\n' + '█'.repeat(60))
  console.log('█  AUTOMATED IMAGE PARAMETER OPTIMIZATION')
  console.log('█'.repeat(60))

  // ============================================================
  // Round 1: Fair Baseline
  // ============================================================
  console.log('\n\n🔬 ROUND 1: Establishing Fair Baseline')
  const r1 = await runAndScore('R1: Baseline (guidance=5, steps=28, temp=0.3)', {
    guidance_scale: 5.0,
    num_inference_steps: 28,
    gemini_temperature: 0.3,
    seed: 42,
  })
  bestScore = r1.score
  bestId = r1.id
  bestParams = { guidance_scale: 5.0, num_inference_steps: 28, gemini_temperature: 0.3, seed: 42 }
  results.push({ round: 'R1', experimentId: r1.id, name: 'Baseline', score: r1.score, params: { ...bestParams } as ExperimentParams })

  logRoundSummary('Round 1: Baseline', [{ name: 'Baseline', score: r1.score, id: r1.id }])

  // ============================================================
  // Round 2: Guidance Scale
  // ============================================================
  console.log('\n\n🔬 ROUND 2: Optimizing guidance_scale')
  const guidanceVariants = [3.5, 5.0, 7.5, 10.0]
  const r2Results: Array<{ name: string; score: number; id: string; value: number }> = []

  for (const g of guidanceVariants) {
    if (g === 5.0) {
      // 重用 baseline 結果
      r2Results.push({ name: `guidance=${g}`, score: r1.score, id: r1.id, value: g })
      continue
    }
    const r = await runAndScore(`R2: guidance=${g}`, { ...bestParams, guidance_scale: g }, bestId)
    r2Results.push({ name: `guidance=${g}`, score: r.score, id: r.id, value: g })
  }

  const r2Winner = r2Results.sort((a, b) => b.score - a.score)[0]
  logRoundSummary('Round 2: guidance_scale', r2Results)

  if (r2Winner.score > bestScore) {
    bestScore = r2Winner.score
    bestId = r2Winner.id
    bestParams.guidance_scale = r2Winner.value
    console.log(`   ✓ Keeping guidance_scale=${r2Winner.value} (${r2Winner.score.toFixed(2)})`)
  } else {
    console.log(`   = No improvement, keeping guidance_scale=${bestParams.guidance_scale}`)
  }

  // ============================================================
  // Round 3: Inference Steps
  // ============================================================
  console.log('\n\n🔬 ROUND 3: Optimizing inference_steps')
  const stepsVariants = [15, 28, 40]
  const r3Results: Array<{ name: string; score: number; id: string; value: number }> = []

  for (const s of stepsVariants) {
    if (s === (bestParams.num_inference_steps ?? 28)) {
      r3Results.push({ name: `steps=${s}`, score: bestScore, id: bestId, value: s })
      continue
    }
    const r = await runAndScore(`R3: steps=${s}`, { ...bestParams, num_inference_steps: s }, bestId)
    r3Results.push({ name: `steps=${s}`, score: r.score, id: r.id, value: s })
  }

  const r3Winner = r3Results.sort((a, b) => b.score - a.score)[0]
  logRoundSummary('Round 3: inference_steps', r3Results)

  if (r3Winner.score > bestScore) {
    bestScore = r3Winner.score
    bestId = r3Winner.id
    bestParams.num_inference_steps = r3Winner.value
    console.log(`   ✓ Keeping num_inference_steps=${r3Winner.value} (${r3Winner.score.toFixed(2)})`)
  } else {
    console.log(`   = No improvement, keeping num_inference_steps=${bestParams.num_inference_steps}`)
  }

  // ============================================================
  // Round 4: Prompt Template Position
  // ============================================================
  console.log('\n\n🔬 ROUND 4: Optimizing prompt template position')
  const posVariants: Array<'prefix' | 'inline' | 'suffix'> = ['prefix', 'inline', 'suffix']
  const r4Results: Array<{ name: string; score: number; id: string; value: string }> = []

  for (const pos of posVariants) {
    if (pos === 'prefix') {
      // prefix is current best
      r4Results.push({ name: `position=${pos}`, score: bestScore, id: bestId, value: pos })
      continue
    }
    const template: PromptTemplate = {
      visual_description_position: pos,
      prefix: '',
      suffix: 'Sharp focus, editorial quality, no text or watermarks.',
      max_prompt_words: 300,
    }
    const r = await runAndScore(`R4: position=${pos}`, { ...bestParams, prompt_template: template }, bestId)
    r4Results.push({ name: `position=${pos}`, score: r.score, id: r.id, value: pos })
  }

  const r4Winner = r4Results.sort((a, b) => b.score - a.score)[0]
  logRoundSummary('Round 4: prompt position', r4Results)

  if (r4Winner.score > bestScore) {
    bestScore = r4Winner.score
    bestId = r4Winner.id
    bestParams.prompt_template = {
      visual_description_position: r4Winner.value as 'prefix' | 'inline' | 'suffix',
      prefix: '',
      suffix: 'Sharp focus, editorial quality, no text or watermarks.',
      max_prompt_words: 300,
    }
    console.log(`   ✓ Keeping position=${r4Winner.value} (${r4Winner.score.toFixed(2)})`)
  } else {
    console.log(`   = No improvement, keeping position=prefix`)
  }

  // ============================================================
  // Round 5: Gemini Temperature
  // ============================================================
  console.log('\n\n🔬 ROUND 5: Optimizing Gemini temperature')
  const tempVariants = [0.1, 0.3, 0.5, 0.7]
  const r5Results: Array<{ name: string; score: number; id: string; value: number }> = []

  for (const t of tempVariants) {
    if (t === (bestParams.gemini_temperature ?? 0.3)) {
      r5Results.push({ name: `temp=${t}`, score: bestScore, id: bestId, value: t })
      continue
    }
    const r = await runAndScore(`R5: temp=${t}`, { ...bestParams, gemini_temperature: t }, bestId)
    r5Results.push({ name: `temp=${t}`, score: r.score, id: r.id, value: t })
  }

  const r5Winner = r5Results.sort((a, b) => b.score - a.score)[0]
  logRoundSummary('Round 5: Gemini temperature', r5Results)

  if (r5Winner.score > bestScore) {
    bestScore = r5Winner.score
    bestId = r5Winner.id
    bestParams.gemini_temperature = r5Winner.value
    console.log(`   ✓ Keeping temperature=${r5Winner.value} (${r5Winner.score.toFixed(2)})`)
  } else {
    console.log(`   = No improvement, keeping temperature=${bestParams.gemini_temperature}`)
  }

  // ============================================================
  // Round 6: Final Validation
  // ============================================================
  console.log('\n\n🔬 ROUND 6: Final Validation with Best Config')
  const finalResult = await runAndScore('FINAL: Optimized Config', bestParams, r1.id)

  // ============================================================
  // Final Report
  // ============================================================
  console.log('\n\n' + '█'.repeat(60))
  console.log('█  OPTIMIZATION COMPLETE')
  console.log('█'.repeat(60))
  console.log('')
  console.log('   Original baseline:  ', r1.score.toFixed(2), '/10')
  console.log('   Final optimized:    ', finalResult.score.toFixed(2), '/10')
  const improvement = ((finalResult.score - r1.score) / r1.score * 100)
  console.log('   Improvement:        ', `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`)
  console.log('')
  console.log('   Best Parameters:')
  console.log(`     guidance_scale:       ${bestParams.guidance_scale}`)
  console.log(`     num_inference_steps:  ${bestParams.num_inference_steps}`)
  console.log(`     gemini_temperature:   ${bestParams.gemini_temperature}`)
  console.log(`     prompt_position:      ${bestParams.prompt_template?.visual_description_position ?? 'prefix'}`)
  console.log(`     seed:                 ${bestParams.seed}`)
  console.log('')

  if (finalResult.score >= r1.score * 1.05) {
    console.log('   ✓ Promoting best config to production...')
    await promoteExperiment(finalResult.id)
    console.log(`   ✓ Experiment ${finalResult.id} promoted!`)
  } else {
    console.log('   ✗ Final score did not beat baseline by 5%+, not promoting.')
    console.log(`     Best experiment ID: ${bestId}`)
  }

  console.log('\n' + '█'.repeat(60))
}

main().catch(err => {
  console.error('\n❌ Optimization failed:', err)
  process.exit(1)
})
