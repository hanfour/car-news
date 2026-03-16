/**
 * 比較兩次實驗結果 CLI
 *
 * 用法：
 *   npx tsx scripts/compare-experiments.ts <experiment_a_id> <experiment_b_id>
 *   npx tsx scripts/compare-experiments.ts --latest
 *   npx tsx scripts/compare-experiments.ts --promote <experiment_id>
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import {
  getExperiment,
  getExperimentSamples,
  compareExperiments,
  listExperiments,
  promoteExperiment,
} from '@/lib/experiments/results'
import { ImageScoreDimensions, SCORE_WEIGHTS } from '@/lib/experiments/types'

function printDimensionComparison(
  label: string,
  dimA: ImageScoreDimensions,
  dimB: ImageScoreDimensions
) {
  const keys: (keyof ImageScoreDimensions)[] = [
    'vehicleAccuracy', 'detailFidelity', 'composition',
    'mood', 'technicalQuality', 'editorialFit',
  ]

  console.log(`\n   ${label}:`)
  console.log('   ' + '-'.repeat(56))
  console.log(`   ${'Dimension'.padEnd(20)} ${'Weight'.padEnd(8)} ${'A'.padEnd(8)} ${'B'.padEnd(8)} Diff`)
  console.log('   ' + '-'.repeat(56))

  for (const key of keys) {
    const weight = SCORE_WEIGHTS[key]
    const a = dimA[key]
    const b = dimB[key]
    const diff = b - a
    const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)
    const indicator = diff > 0.5 ? ' ✓' : diff < -0.5 ? ' ✗' : ''
    console.log(`   ${key.padEnd(20)} ${(weight * 100 + '%').padEnd(8)} ${a.toFixed(2).padEnd(8)} ${b.toFixed(2).padEnd(8)} ${diffStr}${indicator}`)
  }
}

async function compareTwo(idA: string, idB: string) {
  const [expA, expB] = await Promise.all([
    getExperiment(idA),
    getExperiment(idB),
  ])

  if (!expA) {
    console.error(`❌ Experiment not found: ${idA}`)
    process.exit(1)
  }
  if (!expB) {
    console.error(`❌ Experiment not found: ${idB}`)
    process.exit(1)
  }

  const comparison = compareExperiments(expA, expB)

  console.log('\n' + '='.repeat(60))
  console.log('📊 Experiment Comparison')
  console.log('='.repeat(60))

  console.log(`\n   A: ${comparison.a.name} (${comparison.a.id})`)
  if (comparison.a.summary) {
    console.log(`      Score: ${comparison.a.summary.avg_composite}/10 ± ${comparison.a.summary.std_dev}`)
    console.log(`      Images: ${comparison.a.summary.total_images}, Cost: $${comparison.a.summary.total_cost_usd.toFixed(4)}`)
  }

  console.log(`\n   B: ${comparison.b.name} (${comparison.b.id})`)
  if (comparison.b.summary) {
    console.log(`      Score: ${comparison.b.summary.avg_composite}/10 ± ${comparison.b.summary.std_dev}`)
    console.log(`      Images: ${comparison.b.summary.total_images}, Cost: $${comparison.b.summary.total_cost_usd.toFixed(4)}`)
  }

  if (comparison.improvement_pct != null) {
    console.log(`\n   Improvement: ${comparison.improvement_pct > 0 ? '+' : ''}${comparison.improvement_pct}%`)
  }
  console.log(`\n   ${comparison.recommendation}`)

  // 維度比較
  if (comparison.a.summary?.avg_dimensions && comparison.b.summary?.avg_dimensions) {
    printDimensionComparison(
      'Dimension Comparison',
      comparison.a.summary.avg_dimensions,
      comparison.b.summary.avg_dimensions
    )
  }

  // 顯示各文章分數
  const [samplesA, samplesB] = await Promise.all([
    getExperimentSamples(idA),
    getExperimentSamples(idB),
  ])

  if (samplesA.length > 0 || samplesB.length > 0) {
    console.log('\n   Per-article scores:')
    console.log('   ' + '-'.repeat(70))
    console.log(`   ${'Article'.padEnd(40)} ${'A'.padEnd(8)} ${'B'.padEnd(8)} Diff`)
    console.log('   ' + '-'.repeat(70))

    const allArticles = new Set([
      ...samplesA.map(s => s.article_id),
      ...samplesB.map(s => s.article_id),
    ])

    for (const articleId of allArticles) {
      const sA = samplesA.find(s => s.article_id === articleId)
      const sB = samplesB.find(s => s.article_id === articleId)
      const title = (sA?.article_title || sB?.article_title || articleId).slice(0, 38)
      const scoreA = sA?.composite_score
      const scoreB = sB?.composite_score

      const aStr = scoreA != null ? scoreA.toFixed(2) : '-'
      const bStr = scoreB != null ? scoreB.toFixed(2) : '-'
      const diffStr = scoreA != null && scoreB != null
        ? (scoreB - scoreA > 0 ? '+' : '') + (scoreB - scoreA).toFixed(2)
        : '-'

      console.log(`   ${title.padEnd(40)} ${aStr.padEnd(8)} ${bStr.padEnd(8)} ${diffStr}`)
    }
  }

  console.log('\n' + '='.repeat(60))

  if (comparison.improvement_pct != null && comparison.improvement_pct > 5) {
    console.log(`\n   To promote experiment B:`)
    console.log(`   npx tsx scripts/compare-experiments.ts --promote ${idB}`)
  }
}

async function showLatest() {
  const experiments = await listExperiments(10)

  if (experiments.length === 0) {
    console.log('No experiments found.')
    return
  }

  console.log('\n📋 Recent experiments:\n')
  console.log(`   ${'ID'.padEnd(20)} ${'Name'.padEnd(30)} ${'Status'.padEnd(12)} ${'Score'.padEnd(8)} Promoted`)
  console.log('   ' + '-'.repeat(80))

  for (const exp of experiments) {
    const score = exp.summary?.avg_composite != null ? exp.summary.avg_composite.toFixed(2) : '-'
    const promoted = exp.promoted ? '✓' : ''
    console.log(`   ${exp.id.padEnd(20)} ${exp.name.slice(0, 28).padEnd(30)} ${exp.status.padEnd(12)} ${score.padEnd(8)} ${promoted}`)
  }
}

async function promote(id: string) {
  const exp = await getExperiment(id)
  if (!exp) {
    console.error(`❌ Experiment not found: ${id}`)
    process.exit(1)
  }
  if (exp.status !== 'completed') {
    console.error(`❌ Experiment is not completed (status: ${exp.status})`)
    process.exit(1)
  }

  await promoteExperiment(id)
  console.log(`\n✅ Experiment "${exp.name}" (${id}) promoted to production!`)
  console.log('   generateWithFlux() will now use this config as override.')
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage:')
    console.log('  npx tsx scripts/compare-experiments.ts <id_a> <id_b>  — Compare two experiments')
    console.log('  npx tsx scripts/compare-experiments.ts --latest        — List recent experiments')
    console.log('  npx tsx scripts/compare-experiments.ts --promote <id>  — Promote experiment to prod')
    process.exit(0)
  }

  if (args[0] === '--latest') {
    await showLatest()
    return
  }

  if (args[0] === '--promote' && args[1]) {
    await promote(args[1])
    return
  }

  if (args.length >= 2) {
    await compareTwo(args[0], args[1])
    return
  }

  console.error('❌ Invalid arguments. Use --help for usage.')
  process.exit(1)
}

main()
