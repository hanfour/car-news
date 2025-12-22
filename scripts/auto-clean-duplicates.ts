#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import {
  findSemanticDuplicatesInBatch,
  findKeywordDuplicatesInBatch,
  pairsToDuplicateGroups,
  ArticleForDuplicateCheck,
  DuplicateGroup
} from '../src/lib/utils/advanced-deduplication'

/**
 * 自動清理重複文章腳本
 *
 * 功能：
 * 1. 掃描最近 7 天的文章
 * 2. 檢測語義重複（embedding > 90%）和關鍵詞重複（> 70%）
 * 3. 自動下線較新的重複文章（保留最早發布的）
 * 4. 生成清理報告
 */

async function findSemanticDuplicates(): Promise<DuplicateGroup[]> {
  const supabase = createServiceClient()

  console.log('🔍 掃描語義重複（Embedding Similarity > 90%）...')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at, published, view_count, content_embedding, primary_brand')
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('content_embedding', 'is', null)
    .order('created_at', { ascending: true })

  if (!articles || articles.length === 0) {
    console.log('   無文章可檢查')
    return []
  }

  console.log(`   檢查 ${articles.length} 篇文章...`)

  // 使用共用函數檢測重複對
  const articlesForCheck: ArticleForDuplicateCheck[] = articles.map(a => ({
    id: a.id,
    title_zh: a.title_zh,
    created_at: a.created_at,
    published: a.published,
    view_count: a.view_count || 0,
    content_embedding: a.content_embedding,
    primary_brand: a.primary_brand
  }))

  const pairs = findSemanticDuplicatesInBatch(articlesForCheck, 0.90)
  const duplicateGroups = pairsToDuplicateGroups(pairs, articlesForCheck, 'semantic')

  console.log(`   ✓ 發現 ${duplicateGroups.length} 組語義重複`)
  return duplicateGroups
}

async function findKeywordDuplicates(): Promise<DuplicateGroup[]> {
  const supabase = createServiceClient()

  console.log('\n🔍 掃描關鍵詞重複（Keyword Overlap > 70%）...')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, title_zh, created_at, published, view_count, primary_brand')
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('primary_brand', 'is', null)
    .order('created_at', { ascending: true })

  if (!articles || articles.length === 0) {
    console.log('   無文章可檢查')
    return []
  }

  console.log(`   檢查 ${articles.length} 篇文章...`)

  // 使用共用函數檢測重複對
  const articlesForCheck: ArticleForDuplicateCheck[] = articles.map(a => ({
    id: a.id,
    title_zh: a.title_zh,
    created_at: a.created_at,
    published: a.published,
    view_count: a.view_count || 0,
    primary_brand: a.primary_brand
  }))

  const pairs = findKeywordDuplicatesInBatch(articlesForCheck, 0.70, 2)
  const duplicateGroups = pairsToDuplicateGroups(pairs, articlesForCheck, 'keyword')

  console.log(`   ✓ 發現 ${duplicateGroups.length} 組關鍵詞重複`)
  return duplicateGroups
}

async function unpublishDuplicates(groups: DuplicateGroup[], dryRun: boolean = true): Promise<{
  unpublished: number
  kept: number
}> {
  const supabase = createServiceClient()
  let unpublishedCount = 0
  let keptCount = 0

  console.log(`\n${'='.repeat(80)}`)
  console.log(`\n📊 處理重複文章（${dryRun ? 'DRY RUN - 不實際執行' : '正式執行'}）\n`)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]

    console.log(`[組 ${i + 1}/${groups.length}] ${group.type === 'semantic' ? '語義' : '關鍵詞'}重複 (${(group.similarity * 100).toFixed(1)}%)`)

    if (group.keywords && group.keywords.length > 0) {
      console.log(`  共同關鍵詞: ${group.keywords.join(', ')}`)
    }

    // 排序：保留最早創建的文章
    const sorted = [...group.articles].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const toKeep = sorted[0]
    const toUnpublish = sorted.slice(1).filter(a => a.published)

    console.log(`  ✅ 保留: [${toKeep.id}] ${toKeep.title_zh}`)
    console.log(`     創建: ${toKeep.created_at} | 瀏覽: ${toKeep.view_count}`)

    keptCount++

    for (const article of toUnpublish) {
      console.log(`  ❌ 下線: [${article.id}] ${article.title_zh}`)
      console.log(`     創建: ${article.created_at} | 瀏覽: ${article.view_count}`)

      if (!dryRun) {
        const { error } = await supabase
          .from('generated_articles')
          .update({ published: false, published_at: null })
          .eq('id', article.id)

        if (error) {
          console.log(`     ⚠️  下線失敗: ${error.message}`)
        } else {
          console.log(`     ✓ 已下線`)
          unpublishedCount++
        }
      } else {
        unpublishedCount++
      }
    }

    console.log('')
  }

  return { unpublished: unpublishedCount, kept: keptCount }
}

async function generateReport(
  semanticGroups: DuplicateGroup[],
  keywordGroups: DuplicateGroup[],
  stats: { unpublished: number; kept: number },
  dryRun: boolean
) {
  console.log(`${'='.repeat(80)}`)
  console.log('\n📋 清理報告\n')

  console.log(`檢測時間: ${new Date().toLocaleString('zh-TW')}`)
  console.log(`模式: ${dryRun ? '模擬執行（未實際修改）' : '正式執行'}`)

  console.log('\n檢測結果:')
  console.log(`  語義重複組: ${semanticGroups.length}`)
  console.log(`  關鍵詞重複組: ${keywordGroups.length}`)
  console.log(`  總重複組: ${semanticGroups.length + keywordGroups.length}`)

  console.log('\n處理結果:')
  console.log(`  ✅ 保留文章: ${stats.kept}`)
  console.log(`  ❌ 下線文章: ${stats.unpublished}`)

  const totalArticles = stats.kept + stats.unpublished
  const deduplicationRate = totalArticles > 0 ? ((stats.unpublished / totalArticles) * 100).toFixed(1) : '0.0'
  console.log(`  📊 重複率: ${deduplicationRate}%`)

  console.log('\n建議:')
  if (semanticGroups.length > 0 || keywordGroups.length > 0) {
    console.log('  • 檢查 Generator 的防重機制是否正常運作')
    console.log('  • 調整 Topic Lock 的有效期限')
    console.log('  • 考慮提高 embedding 相似度閾值')
  } else {
    console.log('  • ✅ 防重機制運作正常，無需調整')
  }

  console.log(`\n${'='.repeat(80)}`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--execute')

  console.log('🧹 自動清理重複文章\n')
  console.log(`模式: ${dryRun ? '🔍 DRY RUN（模擬執行，不實際修改）' : '⚡ EXECUTE（正式執行）'}`)

  if (dryRun) {
    console.log('提示: 使用 --execute 參數執行實際清理\n')
  } else {
    console.log('⚠️  警告: 將實際下線重複文章！\n')
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  console.log(`${'='.repeat(80)}\n`)

  // 1. 檢測語義重複
  const semanticGroups = await findSemanticDuplicates()

  // 2. 檢測關鍵詞重複
  const keywordGroups = await findKeywordDuplicates()

  // 3. 處理重複
  const allGroups = [...semanticGroups, ...keywordGroups]

  if (allGroups.length === 0) {
    console.log('\n✅ 沒有發現重複文章！')
    console.log(`\n${'='.repeat(80)}`)
    return
  }

  const stats = await unpublishDuplicates(allGroups, dryRun)

  // 4. 生成報告
  await generateReport(semanticGroups, keywordGroups, stats, dryRun)

  if (dryRun) {
    console.log('\n💡 這只是模擬執行。使用 --execute 參數來實際執行清理。')
  } else {
    console.log('\n✅ 清理完成！')
  }
}

main().catch(error => {
  console.error('❌ 執行失敗:', error)
  process.exit(1)
})
