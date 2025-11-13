# Generator Timeout Mitigation Strategy

## 問題背景

Vercel 的 Serverless Function 有硬性的 **300 秒（5 分鐘）執行時間限制**。當 Generator 處理大量文章時（例如 15+ 篇），會因為超時而中斷，導致：

- 部分文章無法完成生成
- 請求直接中斷，沒有返回任何結果
- 需要手動重新執行

## 解決方案：保守式批次處理

### 核心策略

實施 **提前停止（Graceful Stop）** 機制，而不是等到被 Vercel 強制中斷：

```typescript
const TIMEOUT_CONFIG = {
  MAX_DURATION_MS: 270_000,           // 270秒 (4.5分鐘) - 留30秒緩衝
  MAX_ARTICLES_PER_RUN: 8,            // 每次最多處理8篇文章
  TIME_CHECK_INTERVAL: 1000,          // 每1秒檢查一次時間
  ESTIMATED_TIME_PER_ARTICLE: 30_000  // 估計每篇文章需要30秒
}
```

### 三層檢查機制

#### 1. 品牌層級檢查
在處理每個品牌前檢查是否應該繼續：

```typescript
for (const [brand, brandArticles] of brandGroups.entries()) {
  if (!shouldContinueProcessing(totalProcessed)) {
    console.log(`⏭️  Skipping remaining brands to avoid timeout`)
    break
  }
  // ... 處理品牌
}
```

#### 2. 聚類層級檢查
在處理每個文章聚類前檢查：

```typescript
for (const cluster of brandClusters) {
  if (!shouldContinueProcessing(totalProcessed)) {
    console.log(`[${brand}] ⏸️  Stopping cluster processing to avoid timeout`)
    break
  }
  // ... 生成文章
}
```

#### 3. 雙重終止條件
`shouldContinueProcessing()` 函數檢查兩個條件：

```typescript
function shouldContinueProcessing(processedCount: number): boolean {
  const elapsedTime = Date.now() - startTime
  const remainingTime = TIMEOUT_CONFIG.MAX_DURATION_MS - elapsedTime
  const estimatedTimeForNext = TIMEOUT_CONFIG.ESTIMATED_TIME_PER_ARTICLE

  // 條件1: 已達到最大文章數限制
  if (processedCount >= TIMEOUT_CONFIG.MAX_ARTICLES_PER_RUN) {
    return false
  }

  // 條件2: 剩餘時間不足以處理下一篇
  if (remainingTime < estimatedTimeForNext) {
    return false
  }

  return true
}
```

## 效果

### 優點
✅ **零超時風險**：保留 30 秒緩衝，確保永遠不會被 Vercel 強制中斷
✅ **正常返回結果**：即使提前停止，也會返回已完成文章的完整資訊
✅ **自動分批**：未處理的文章會在下次執行時自動處理
✅ **清晰日誌**：明確顯示停止原因和進度

### 運作範例

**場景 1：15 篇待處理文章**

```
Run 1: 處理 8 篇 (4.5分鐘) ✅ 正常完成
Run 2: 處理剩餘 7 篇 (3.5分鐘) ✅ 正常完成
```

**場景 2：50 篇待處理文章**

```
Run 1: 處理 8 篇 ✅
Run 2: 處理 8 篇 ✅
Run 3: 處理 8 篇 ✅
Run 4: 處理 8 篇 ✅
Run 5: 處理 8 篇 ✅
Run 6: 處理 10 篇 ✅
```

## 日誌輸出

### 處理中的進度提示

```
[Tesla] ✓ Published: Model 3 降價消息 (4 images stored) [1/8]
[Tesla] ✓ Published: Cybertruck 新功能 (6 images stored) [2/8]
...
[BMW] ✓ Published: iX 電動休旅車 (5 images stored) [8/8]
⏸️  Reached article limit (8), stopping gracefully
```

### 最終摘要

```
⏸️  === GRACEFUL STOP ===
Processed: 8 articles
Time: 268s / 270s
Reason: Article limit
Note: Remaining articles will be processed in next run
```

## API 返回格式

成功返回時包含 `timeout_info`：

```json
{
  "success": true,
  "generated": 8,
  "published": 7,
  "duration": 268000,
  "timeout_info": {
    "hit_limit": true,
    "processed": 8,
    "max_per_run": 8,
    "reason": "article_limit"
  },
  "articles": [...]
}
```

## 調整配置

如果需要調整處理策略，修改 `src/app/api/cron/generator/route.ts` 中的 `TIMEOUT_CONFIG`：

```typescript
const TIMEOUT_CONFIG = {
  MAX_DURATION_MS: 270_000,       // 增加/減少時間限制
  MAX_ARTICLES_PER_RUN: 10,       // 增加每次處理數量（風險較高）
  ESTIMATED_TIME_PER_ARTICLE: 25_000  // 根據實際測試調整
}
```

### 建議值

| 環境 | MAX_ARTICLES_PER_RUN | MAX_DURATION_MS | 備註 |
|------|---------------------|-----------------|------|
| 開發測試 | 3-5 | 120_000 (2分鐘) | 快速迭代 |
| 生產環境 | 8-10 | 270_000 (4.5分鐘) | 保守穩定 |
| 高峰時段 | 6-8 | 240_000 (4分鐘) | 額外保險 |

## 監控建議

### 定期檢查 cron_logs

```sql
SELECT
  created_at,
  metadata->>'articles_generated' as generated,
  metadata->>'duration_ms' as duration_ms,
  metadata->>'hit_timeout' as hit_timeout,
  metadata->>'timeout_reason' as reason
FROM cron_logs
WHERE job_name = 'generator'
ORDER BY created_at DESC
LIMIT 10;
```

### 警報條件

⚠️ **需要關注**：
- `hit_timeout = true` 且 `timeout_reason = 'time_limit'`（時間逼近限制）
- `duration_ms > 250000`（超過 4 分鐘 10 秒）

✅ **正常運作**：
- `hit_timeout = true` 且 `timeout_reason = 'article_limit'`（符合預期）
- `duration_ms < 270000`（在安全範圍內）

## 未來改進方向

### 選項 1: 實施任務佇列
使用 **Upstash QStash** 或 **BullMQ** 實現真正的背景任務處理，不受 Vercel 限制。

### 選項 2: 拆分為多個 Endpoint
```
/api/cron/generator/priority-brands  (處理 Tesla, BMW 等熱門品牌)
/api/cron/generator/other-brands     (處理其他品牌)
```

### 選項 3: Edge Functions
將部分輕量級處理移到 Vercel Edge Functions（無時間限制）。

---

**實施日期**: 2025-11-13
**測試狀態**: ⏳ 待測試
**生產狀態**: ⏳ 待部署
