/**
 * 圖片生成實驗 CLI
 *
 * 用法：
 *   npx tsx scripts/run-experiment.ts <preset_name> [baseline_id]
 *   npx tsx scripts/run-experiment.ts --list
 *
 * 範例：
 *   npx tsx scripts/run-experiment.ts baseline
 *   npx tsx scripts/run-experiment.ts high_guidance exp-20260315-abc
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { createConfigFromPreset, listPresets } from '@/lib/experiments/config-presets'
import { runExperiment } from '@/lib/experiments/runner'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: npx tsx scripts/run-experiment.ts <preset_name> [baseline_id]')
    console.log('       npx tsx scripts/run-experiment.ts --list')
    console.log('')
    console.log('Available presets:')
    for (const preset of listPresets()) {
      console.log(`  ${preset.name.padEnd(20)} — ${preset.description}`)
    }
    process.exit(0)
  }

  if (args[0] === '--list') {
    console.log('\n📋 Available experiment presets:\n')
    for (const preset of listPresets()) {
      console.log(`  ${preset.name.padEnd(20)} — ${preset.description}`)
    }
    process.exit(0)
  }

  const presetName = args[0]
  const baselineId = args[1]

  try {
    const config = createConfigFromPreset(presetName, baselineId)
    console.log(`\n🚀 Starting experiment "${config.name}" (${config.id})`)

    await runExperiment(config)

    console.log('\n✅ Experiment completed successfully!')
    console.log(`   ID: ${config.id}`)
    console.log(`\n   To compare with baseline:`)
    console.log(`   npx tsx scripts/compare-experiments.ts <baseline_id> ${config.id}`)
  } catch (error) {
    console.error('\n❌ Experiment failed:', error)
    process.exit(1)
  }
}

main()
