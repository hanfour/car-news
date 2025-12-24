/**
 * Round-Robin Brand Distribution Algorithm
 *
 * 輪盤式品牌分配算法：確保所有品牌都有機會被處理
 *
 * 核心邏輯：
 * 1. 記住上次結束的品牌位置
 * 2. 從該位置開始，輪流從每個品牌收集文章
 * 3. 每輪每個品牌最多選一篇
 * 4. 循環直到達成目標或所有品牌都沒有可用文章
 */

import { createServiceClient } from '@/lib/supabase'

// 狀態存儲的 key
const WHEEL_STATE_KEY = 'brand_wheel_position'

interface WheelState {
  lastBrandIndex: number      // 上次結束時的品牌索引
  lastRunTimestamp: string    // 上次執行時間
  brandsOrder: string[]       // 品牌順序（用於驗證一致性）
}

interface ClusterData<T> {
  articles: T[]
  centroid: number[] | null
  size: number
  similarity: number
}

interface BrandCluster<T> {
  brand: string
  clusters: ClusterData<T>[]
}

interface CollectedItem<T> {
  brand: string
  cluster: ClusterData<T>
  roundNumber: number
}

/**
 * 從 Supabase 獲取輪盤狀態
 */
export async function getWheelState(): Promise<WheelState | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generator_state')
    .select('value')
    .eq('key', WHEEL_STATE_KEY)
    .single()

  if (error || !data) {
    console.log('[RoundRobin] No previous wheel state found, starting fresh')
    return null
  }

  return data.value as WheelState
}

/**
 * 保存輪盤狀態到 Supabase
 */
export async function saveWheelState(state: WheelState): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('generator_state')
    .upsert({
      key: WHEEL_STATE_KEY,
      value: state,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })

  if (error) {
    console.error('[RoundRobin] Failed to save wheel state:', error)
    return false
  }

  console.log(`[RoundRobin] Saved wheel state: lastBrandIndex=${state.lastBrandIndex}`)
  return true
}

/**
 * 輪盤式收集算法
 *
 * @param brandClusters - 按品牌分組的聚類數據
 * @param targetCount - 目標收集數量
 * @param maxPerBrand - 每個品牌最多收集數量
 * @returns 收集結果列表（按輪盤順序）
 */
export async function collectByRoundRobin<T>(
  brandClusters: BrandCluster<T>[],
  targetCount: number,
  maxPerBrand: number = 3
): Promise<{
  collected: CollectedItem<T>[]
  nextStartIndex: number
  roundsCompleted: number
}> {
  if (brandClusters.length === 0) {
    return { collected: [], nextStartIndex: 0, roundsCompleted: 0 }
  }

  // 1. 獲取上次的輪盤狀態
  const previousState = await getWheelState()

  // 2. 計算起始索引
  let startIndex = 0
  if (previousState) {
    // 驗證品牌順序是否一致（品牌列表可能變化）
    const currentBrands = brandClusters.map(bc => bc.brand)

    if (previousState.brandsOrder.length === currentBrands.length &&
        previousState.brandsOrder.every((b, i) => b === currentBrands[i])) {
      // 品牌順序一致，從上次結束位置的下一個開始
      startIndex = (previousState.lastBrandIndex + 1) % brandClusters.length
      console.log(`[RoundRobin] Resuming from index ${startIndex} (${brandClusters[startIndex].brand})`)
    } else {
      // 品牌列表變化，重置
      console.log('[RoundRobin] Brand list changed, resetting to index 0')
    }
  }

  // 3. 準備收集狀態
  const collected: CollectedItem<T>[] = []
  const brandUsedCounts = new Map<string, number>()  // 每個品牌已使用的 cluster 數量
  const usedClusterIndices = new Map<string, Set<number>>()  // 每個品牌已使用的 cluster 索引

  // 初始化
  for (const bc of brandClusters) {
    brandUsedCounts.set(bc.brand, 0)
    usedClusterIndices.set(bc.brand, new Set())
  }

  let currentIndex = startIndex
  let roundNumber = 1
  let consecutiveSkips = 0  // 連續跳過的品牌數（用於檢測是否所有品牌都耗盡）

  console.log(`\n[RoundRobin] 🎡 Starting wheel collection`)
  console.log(`  Target: ${targetCount} articles`)
  console.log(`  Brands: ${brandClusters.length}`)
  console.log(`  Start index: ${startIndex} (${brandClusters[startIndex].brand})`)

  // 4. 輪盤式收集
  while (collected.length < targetCount) {
    const brandData = brandClusters[currentIndex]
    const { brand, clusters } = brandData

    const usedCount = brandUsedCounts.get(brand) || 0
    const usedIndices = usedClusterIndices.get(brand) || new Set()

    // 檢查品牌是否還有配額和可用 cluster
    let selectedCluster: ClusterData<T> | null = null
    let selectedClusterIndex = -1

    if (usedCount < maxPerBrand) {
      // 找到第一個未使用的 cluster
      for (let i = 0; i < clusters.length; i++) {
        if (!usedIndices.has(i)) {
          selectedCluster = clusters[i]
          selectedClusterIndex = i
          break
        }
      }
    }

    if (selectedCluster) {
      // 收集這個 cluster
      collected.push({
        brand,
        cluster: selectedCluster,
        roundNumber
      })

      // 更新狀態
      brandUsedCounts.set(brand, usedCount + 1)
      usedIndices.add(selectedClusterIndex)
      usedClusterIndices.set(brand, usedIndices)
      consecutiveSkips = 0

      console.log(`  [Round ${roundNumber}] ${brand}: collected cluster #${selectedClusterIndex + 1} (${selectedCluster.size} sources) [${collected.length}/${targetCount}]`)
    } else {
      // 這個品牌沒有可用的 cluster
      consecutiveSkips++

      // 如果連續跳過了所有品牌，說明所有品牌都耗盡了
      if (consecutiveSkips >= brandClusters.length) {
        console.log(`  [Round ${roundNumber}] All brands exhausted, stopping`)
        break
      }
    }

    // 移動到下一個品牌
    currentIndex = (currentIndex + 1) % brandClusters.length

    // 如果回到起始位置，進入下一輪
    if (currentIndex === startIndex) {
      roundNumber++
      console.log(`  --- Round ${roundNumber} ---`)
    }
  }

  console.log(`[RoundRobin] 🎡 Collection complete: ${collected.length} items in ${roundNumber} rounds`)

  // 5. 計算下次的起始位置
  // 下次應該從最後處理的品牌的下一個開始
  const nextStartIndex = currentIndex

  // 6. 保存狀態
  const newState: WheelState = {
    lastBrandIndex: (currentIndex - 1 + brandClusters.length) % brandClusters.length,
    lastRunTimestamp: new Date().toISOString(),
    brandsOrder: brandClusters.map(bc => bc.brand)
  }

  await saveWheelState(newState)

  return {
    collected,
    nextStartIndex,
    roundsCompleted: roundNumber
  }
}

/**
 * 按優先級排序品牌（保持與原有邏輯兼容）
 */
export function sortBrandsByPriority<T>(
  brandGroups: Map<string, T[]>,
  priorityBrands: string[]
): Array<{ brand: string; articles: T[] }> {
  const sorted = Array.from(brandGroups.entries())
    .map(([brand, articles]) => ({ brand, articles }))
    .sort((a, b) => {
      // "Other" 永遠最後
      if (a.brand === 'Other') return 1
      if (b.brand === 'Other') return -1

      const priorityIndexA = priorityBrands.indexOf(a.brand)
      const priorityIndexB = priorityBrands.indexOf(b.brand)

      const isPriorityA = priorityIndexA !== -1
      const isPriorityB = priorityIndexB !== -1

      // 兩個都是優先品牌：按優先順序排
      if (isPriorityA && isPriorityB) {
        return priorityIndexA - priorityIndexB
      }

      // 只有一個是優先品牌
      if (isPriorityA && !isPriorityB) return -1
      if (!isPriorityA && isPriorityB) return 1

      // 都不是優先品牌：按文章數量排
      return b.articles.length - a.articles.length
    })

  return sorted
}
