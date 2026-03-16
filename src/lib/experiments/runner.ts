/**
 * 實驗核心迴圈
 * 生成 → 評分 → 比較 → 存結果
 */

import { ExperimentConfig, ExperimentSample } from './types'
import { selectTestArticles } from './article-selector'
import { buildParameterizedPrompt } from './prompt-builder'
import { scoreImage } from './scorer'
import {
  createExperiment,
  updateExperimentStatus,
  saveSample,
  getExperiment,
  computeSummary,
} from './results'
import { generateImagePromptFromArticle } from '@/lib/ai/image-prompt-generator'
import { generateWithFlux } from '@/lib/ai/flux-image-generation'
import { uploadImageFromUrl } from '@/lib/storage/image-uploader'
import { getErrorMessage } from '@/lib/utils/error'

const FLUX_COST_PER_IMAGE = 0.008
const GEMINI_SCORE_COST = 0.001
const GEMINI_PROMPT_COST = 0.001

/**
 * 驗證實驗配置參數
 */
function validateConfig(config: ExperimentConfig): void {
  const { params, budget } = config

  if (params.guidance_scale < 1 || params.guidance_scale > 20) {
    throw new Error(`guidance_scale must be 1-20, got ${params.guidance_scale}`)
  }
  if (params.num_inference_steps < 10 || params.num_inference_steps > 50) {
    throw new Error(`num_inference_steps must be 10-50, got ${params.num_inference_steps}`)
  }
  if (params.gemini_temperature < 0 || params.gemini_temperature > 1) {
    throw new Error(`gemini_temperature must be 0-1, got ${params.gemini_temperature}`)
  }
  if (budget.max_images < 1) {
    throw new Error('max_images must be >= 1')
  }
  if (budget.max_cost_usd <= 0) {
    throw new Error('max_cost_usd must be > 0')
  }
}

/**
 * 檢查每日預算上限
 */
async function checkDailyBudget(): Promise<void> {
  const dailyBudget = parseFloat(process.env.EXPERIMENT_DAILY_BUDGET || '1.00')
  // TODO: 從 DB 查詢今日已花費金額
  // 目前只做提示
  console.log(`   Daily budget limit: $${dailyBudget.toFixed(2)}`)
}

/**
 * 執行單一實驗
 */
export async function runExperiment(config: ExperimentConfig): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log(`🧪 Running experiment: ${config.name}`)
  console.log(`   ID: ${config.id}`)
  console.log(`   Guidance: ${config.params.guidance_scale}`)
  console.log(`   Steps: ${config.params.num_inference_steps}`)
  console.log(`   Gemini temp: ${config.params.gemini_temperature}`)
  console.log(`   Prompt position: ${config.params.prompt_template.visual_description_position}`)
  console.log(`   Budget: ${config.budget.max_images} images / $${config.budget.max_cost_usd}`)
  console.log('='.repeat(60))

  // 1. 驗證配置
  validateConfig(config)
  await checkDailyBudget()

  // 2. 建立 DB 記錄
  await createExperiment(config)
  await updateExperimentStatus(config.id, 'running', {
    started_at: new Date().toISOString(),
  })

  const startTime = Date.now()
  const samples: ExperimentSample[] = []
  let totalCost = 0

  try {
    // 3. 選取測試文章
    const articles = await selectTestArticles(config.budget.max_images)

    // 4. 逐篇生成 + 評分
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]

      // 檢查預算
      const estimatedCost = FLUX_COST_PER_IMAGE + GEMINI_SCORE_COST + GEMINI_PROMPT_COST
      if (totalCost + estimatedCost > config.budget.max_cost_usd) {
        console.log(`\n⚠ Budget limit reached ($${totalCost.toFixed(4)}/$${config.budget.max_cost_usd})`)
        break
      }

      console.log(`\n--- [${i + 1}/${articles.length}] ${article.title.slice(0, 50)}... ---`)

      const sampleStartTime = Date.now()
      let sample: ExperimentSample

      try {
        // 4a. 用 Gemini 生成 prompt（帶溫度參數）
        const promptResult = await generateImagePromptFromArticle(
          article.title,
          article.content,
          article.brands,
          { temperature: config.params.gemini_temperature }
        )

        // 4b. 參數化 prompt 組裝
        const finalPrompt = buildParameterizedPrompt(
          promptResult,
          config.params,
          article.title,
          article.brands[0]
        )

        console.log(`   Prompt: ${finalPrompt.slice(0, 100)}...`)

        // 4c. 呼叫 Flux 生成圖片（帶 overrides）
        const imageResult = await generateWithFlux(finalPrompt, {
          guidanceScale: config.params.guidance_scale,
          numInferenceSteps: config.params.num_inference_steps,
          seed: config.params.seed,
        })

        if (!imageResult || !imageResult.url || imageResult.error) {
          throw new Error(imageResult?.error || 'Flux returned no image')
        }

        totalCost += FLUX_COST_PER_IMAGE + GEMINI_PROMPT_COST

        // 4d. 嘗試上傳到 R2（experiments/ 前綴），失敗則用 Flux 暫時 URL
        let finalImageUrl = imageResult.url
        try {
          const r2Key = `experiments/${config.id}/${article.id}`
          const uploadedUrl = await uploadImageFromUrl(imageResult.url, r2Key)
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl
          }
        } catch {
          console.log('   ⚠ R2 upload failed, using temporary Flux URL for scoring')
        }

        // 4e. Gemini Vision 評分
        const score = await scoreImage(finalImageUrl, article.title, finalPrompt)
        totalCost += GEMINI_SCORE_COST

        console.log(`   Score: ${score.composite}/10 — ${score.explanation.slice(0, 80)}`)

        sample = {
          article_id: article.id,
          article_title: article.title,
          prompt_used: finalPrompt,
          image_url: finalImageUrl,
          seed_used: config.params.seed || null,
          generation_time_ms: Date.now() - sampleStartTime,
          scores: score.dimensions,
          composite_score: score.composite,
          score_explanation: score.explanation,
          cost_usd: FLUX_COST_PER_IMAGE + GEMINI_SCORE_COST + GEMINI_PROMPT_COST,
        }
      } catch (error) {
        console.error(`   ✗ Failed: ${getErrorMessage(error)}`)
        sample = {
          article_id: article.id,
          article_title: article.title,
          prompt_used: '',
          image_url: null,
          seed_used: config.params.seed || null,
          generation_time_ms: Date.now() - sampleStartTime,
          scores: null,
          composite_score: null,
          score_explanation: `Error: ${getErrorMessage(error)}`,
          cost_usd: totalCost > 0 ? GEMINI_PROMPT_COST : 0,
        }
      }

      samples.push(sample)
      await saveSample(config.id, sample)
    }

    // 5. 計算 summary
    const durationMs = Date.now() - startTime
    const summary = computeSummary(samples, durationMs)

    // 6. 若有 baseline → 計算 improvement %
    let improvement_pct: number | null = null
    if (config.baseline_experiment_id) {
      const baseline = await getExperiment(config.baseline_experiment_id)
      if (baseline?.summary && baseline.summary.avg_composite > 0) {
        improvement_pct = Math.round(
          ((summary.avg_composite - baseline.summary.avg_composite) / baseline.summary.avg_composite) * 10000
        ) / 100
      }
    }

    // 7. 更新實驗（status = completed）
    await updateExperimentStatus(config.id, 'completed', {
      summary,
      results: samples,
      total_cost_usd: summary.total_cost_usd,
      total_images: summary.total_images,
      improvement_pct,
      completed_at: new Date().toISOString(),
    })

    // 輸出結果
    console.log('\n' + '='.repeat(60))
    console.log('📊 Experiment Results')
    console.log('='.repeat(60))
    console.log(`   Name: ${config.name}`)
    console.log(`   Images: ${summary.total_images}`)
    console.log(`   Avg Score: ${summary.avg_composite}/10`)
    console.log(`   Std Dev: ${summary.std_dev}`)
    console.log(`   Min/Max: ${summary.min_score} / ${summary.max_score}`)
    console.log(`   Cost: $${summary.total_cost_usd.toFixed(4)}`)
    console.log(`   Duration: ${(summary.duration_ms / 1000).toFixed(1)}s`)
    console.log('')
    console.log('   Dimensions:')
    for (const [key, val] of Object.entries(summary.avg_dimensions)) {
      console.log(`     ${key}: ${val}`)
    }

    if (improvement_pct != null) {
      console.log('')
      console.log(`   vs Baseline: ${improvement_pct > 0 ? '+' : ''}${improvement_pct}%`)
      if (improvement_pct > 5) {
        console.log('   ✓ CANDIDATE for promotion!')
      }
    }

    console.log('='.repeat(60))

  } catch (error) {
    console.error(`\n✗ Experiment failed: ${getErrorMessage(error)}`)
    await updateExperimentStatus(config.id, 'failed', {
      completed_at: new Date().toISOString(),
    })
    throw error
  }
}
