# Generator Cron 重构建议

## 问题
`src/app/api/cron/generator/route.ts` 是一个 **406 行**的单一函数，违反了 Linus Torvalds 的准则：
> "If you need more than 3 levels of indentation, you're fucked."

## 建议的重构方案

### 1. 拆分为独立函数

```typescript
// src/lib/cron/generator-helpers.ts

/**
 * 处理单个品牌的所有聚类
 */
export async function processBrandClusters(
  brand: string,
  clusters: ArticleCluster[],
  today: string
): Promise<ProcessResult[]>

/**
 * 检查并锁定话题（防重复）
 */
async function checkAndLockTopic(
  topicHash: string,
  today: string
): Promise<boolean>

/**
 * 从聚类生成文章
 */
async function generateArticleFromCluster(
  cluster: ArticleCluster,
  brand: string
): Promise<GeneratedArticleData | null>

/**
 * 处理文章图片
 */
async function processArticleImages(
  articles: RawArticle[],
  generated: GeneratedArticleData
): Promise<ImageResult>

/**
 * 存储生成的文章
 */
async function storeGeneratedArticle(
  params: StoreArticleParams
): Promise<string | null>
```

### 2. 添加超时保护

```typescript
/**
 * 检查是否应该继续处理
 * 留30秒buffer用于清理
 */
export function shouldContinueProcessing(
  startTime: number,
  maxDuration: number
): boolean {
  const elapsed = Date.now() - startTime
  const remaining = (maxDuration * 1000) - elapsed
  const bufferMs = 30 * 1000 // 30秒buffer
  return remaining > bufferMs
}

// 使用
for (const [brand, clusters] of Object.entries(brandGroups)) {
  if (!shouldContinueProcessing(startTime, maxDuration)) {
    console.log('⏱️ Time budget exhausted, stopping...')
    break
  }

  // 处理...
}
```

### 3. 添加错误恢复

```typescript
try {
  await processBrandClusters(brand, clusters, today)
} catch (error) {
  console.error(`[${brand}] ❌ Fatal error:`, error)
  // 记录到数据库
  await logCronError(brand, error)
  // 继续处理下一个品牌，而不是整体失败
  continue
}
```

### 4. 添加进度追踪

```typescript
interface CronRunStats {
  startTime: number
  brandsProcessed: number
  clustersProcessed: number
  articlesGenerated: number
  errors: number
  timeoutReached: boolean
}

// 在 Cron 结束时存储统计
await supabase
  .from('cron_runs')
  .insert({
    type: 'generator',
    stats: runStats,
    duration_ms: Date.now() - startTime
  })
```

## 优先级

- **P2** (中优先级) - 代码可读性和维护性
- 当前代码虽然长，但功能正常
- 建议在下次迭代中重构

## 注意事项

- 重构时保持功能完全一致
- 添加单元测试覆盖关键函数
- 保留原始逻辑作为参考
- 分阶段重构，每次改动后验证

## 参考

- 原始文件: `src/app/api/cron/generator/route.ts`
- 行数: 406 行
- 复杂度: 高（6层嵌套）
