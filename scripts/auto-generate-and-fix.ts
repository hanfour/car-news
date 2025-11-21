/**
 * 自動化生成並修復文章日期
 *
 * 功能：
 * 1. 運行生成器生成文章
 * 2. 自動修復生成文章的發布日期
 * 3. 可指定運行輪數
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface GeneratorResult {
  success: boolean
  generated: number
  published: number
  duration: number
}

async function runGeneratorOnce(): Promise<GeneratorResult | null> {
  try {
    console.log('\n🤖 運行生成器...')
    const { stdout, stderr } = await execAsync('npx tsx scripts/run-generator.ts')

    // 嘗試從輸出中提取 JSON
    // 查找包含 "generated", "published", "duration" 的 JSON 對象
    const jsonMatch = stdout.match(/\{[^{}]*"generated"\s*:\s*\d+[^{}]*"published"\s*:\s*\d+[^{}]*\}/)
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0])
        console.log(`   ✓ 生成 ${result.generated} 篇文章`)
        console.log(`   ✓ 發布 ${result.published} 篇文章`)
        if (result.duration) {
          console.log(`   ✓ 耗時 ${(result.duration / 1000).toFixed(1)} 秒`)
        }
        return {
          success: result.success || true,
          generated: result.generated || 0,
          published: result.published || 0,
          duration: result.duration || 0
        }
      } catch (parseError) {
        console.error('   ❌ JSON 解析失敗')
        return null
      }
    }

    console.error('   ❌ 無法從輸出中提取結果')
    if (stderr) {
      console.error('   錯誤輸出：', stderr.substring(0, 200))
    }
    return null
  } catch (error: any) {
    console.error('   ❌ 生成器失敗：', error.message)
    return null
  }
}

async function fixDates(): Promise<number> {
  try {
    console.log('\n🔧 修復文章日期...')
    const { stdout } = await execAsync('npx tsx scripts/fix-published-dates.ts')

    // 解析修復數量
    const fixedMatch = stdout.match(/修復：(\d+) 篇/)
    const fixed = fixedMatch ? parseInt(fixedMatch[1]) : 0

    console.log(`   ✓ 修復了 ${fixed} 篇文章`)
    return fixed
  } catch (error: any) {
    console.error('   ❌ 修復失敗：', error.message)
    return 0
  }
}

async function checkRemaining(): Promise<number> {
  try {
    const { stdout } = await execAsync(`
      source .env.local && npx tsx -e "
        import { createClient } from '@supabase/supabase-js';
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const main = async () => {
          const { count } = await supabase
            .from('raw_articles')
            .select('*', { count: 'exact', head: true })
            .is('cluster_id', null);
          console.log(count || 0);
        };
        main();
      "
    `)

    const count = parseInt(stdout.trim())
    return isNaN(count) ? 0 : count
  } catch (error) {
    return 0
  }
}

async function autoGenerateAndFix(rounds: number = 10) {
  console.log('\n🚀 ===== 自動化生成與修復 =====\n')
  console.log(`計劃運行 ${rounds} 輪\n`)

  let totalGenerated = 0
  let totalFixed = 0
  const startTime = Date.now()

  for (let i = 1; i <= rounds; i++) {
    console.log(`\n━━━━━ 第 ${i}/${rounds} 輪 ━━━━━`)

    // 1. 運行生成器
    const result = await runGeneratorOnce()
    if (!result) {
      console.log('⚠️  生成器失敗，跳過此輪')
      continue
    }

    totalGenerated += result.generated

    // 如果沒有生成任何文章，可能已經處理完所有文章
    if (result.generated === 0) {
      console.log('\n✅ 沒有更多文章需要生成，提前結束')
      break
    }

    // 2. 修復日期
    const fixed = await fixDates()
    totalFixed += fixed

    // 3. 檢查剩餘文章數
    const remaining = await checkRemaining()
    console.log(`\n📊 進度：已生成 ${totalGenerated} 篇，剩餘約 ${remaining} 篇原始文章`)

    // 4. 等待一下再進行下一輪（避免 API rate limit）
    if (i < rounds) {
      console.log('\n⏳ 等待 5 秒後繼續...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log('\n\n✅ ===== 完成 =====\n')
  console.log(`總共運行：${Math.min(rounds, totalGenerated > 0 ? Math.ceil(totalGenerated / 2) : 0)} 輪`)
  console.log(`生成文章：${totalGenerated} 篇`)
  console.log(`修復日期：${totalFixed} 篇`)
  console.log(`總耗時：${totalTime} 分鐘\n`)
}

// 從命令行參數獲取輪數，默認 10 輪
const rounds = process.argv[2] ? parseInt(process.argv[2]) : 10

autoGenerateAndFix(rounds)
