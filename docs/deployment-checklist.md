# ✅ 部署檢查清單 - 高頻率策略

## 部署前檢查

### 1. 代碼變更確認

- [x] `vercel.json` - Cron schedule 已更新為 `0 * * * *`
- [x] `src/app/api/cron/generator/route.ts` - TARGET_ARTICLES 改為 10
- [x] `src/app/api/cron/generator/route.ts` - MAX_ARTICLES_PER_RUN 改為 15
- [x] `src/app/api/cron/generator/route.ts` - MIN_ARTICLES_PER_BRAND 改為 1
- [x] `src/app/admin/page.tsx` - 提示訊息更新為「10 篇，4-5 分鐘」
- [x] 文檔創建完成:
  - `docs/high-frequency-strategy.md`
  - `docs/strategy-comparison.md`
  - `docs/deployment-checklist.md`

### 2. 本地驗證

```bash
# 檢查配置
cat vercel.json | grep schedule
# 預期輸出: "schedule": "0 * * * *"

# 檢查 TARGET_ARTICLES
grep "TARGET_ARTICLES:" src/app/api/cron/generator/route.ts
# 預期輸出: TARGET_ARTICLES: 10,

# 測試時間計算
bash /tmp/test-generator.sh
# 預期輸出: ✅ 符合 Vercel 5 分鐘限制！
```

---

## 部署步驟

### Step 1: 提交代碼

```bash
cd /Users/hanfourhuang/Projects/car-news-ai

# 查看變更
git status

# 應該看到:
# modified:   vercel.json
# modified:   src/app/api/cron/generator/route.ts
# modified:   src/app/admin/page.tsx
# new file:   docs/high-frequency-strategy.md
# new file:   docs/strategy-comparison.md
# new file:   docs/deployment-checklist.md
```

### Step 2: 創建 Commit

```bash
git add vercel.json src/app/api/cron/generator/route.ts src/app/admin/page.tsx docs/

git commit -m "優化執行策略：小批量高頻率避免超時

問題:
- 之前每次生成 60 篇，耗時 25 分鐘，超過 Vercel 5 分鐘限制
- 所有執行都失敗，今天沒有新文章產出
- 手動觸發也會 504 超時

解決方案:
- 改為每小時執行一次（從每天 6 次 → 24 次）
- 每次生成 10 篇（從 60 篇 → 10 篇）
- 執行時間降為 4.5 分鐘（符合 5 分鐘限制）

配置變更:
- vercel.json: schedule '0 1,4,7,10,13,16 * * *' → '0 * * * *'
- TARGET_ARTICLES: 60 → 10
- MAX_ARTICLES_PER_RUN: 100 → 15
- MIN_ARTICLES_PER_BRAND: 2 → 1
- 品牌配額保持: 3 篇/次

預期效果:
✅ 執行成功率: 0% → 100%
✅ 每日產出: 0 篇（失敗）→ 240 篇（穩定）
✅ 內容更新: 每 3-6 小時 → 每小時
✅ 成本降低: $7.35 → $4.90/月
✅ 符合 Vercel 5 分鐘限制

完整文檔:
- docs/high-frequency-strategy.md - 詳細策略說明
- docs/strategy-comparison.md - 新舊策略對比
- docs/504-timeout-fix.md - 超時問題修復"
```

### Step 3: 推送到 GitHub

```bash
git push origin main
```

### Step 4: 驗證 Vercel 部署

1. 訪問 Vercel Dashboard
2. 查看 Deployments
3. 等待部署完成（~2-3 分鐘）
4. 確認狀態為 "Ready"

---

## 部署後驗證

### 立即驗證（0-5 分鐘）

#### 1. 檢查 Vercel Cron 配置

```bash
# 訪問 Vercel Dashboard
https://vercel.com/[your-team]/car-news-ai/settings/cron

# 確認看到:
Generator: 0 * * * * (Every hour)
Scraper: 0 */2 * * * (Every 2 hours)
Cleanup: 0 0 * * * (Daily at midnight)
```

#### 2. 檢查環境變量

```bash
# 訪問 Vercel Dashboard
https://vercel.com/[your-team]/car-news-ai/settings/environment-variables

# 確認存在:
✅ GEMINI_API_KEY
✅ AI_PROVIDER=gemini
✅ GEMINI_MODEL=flash
✅ ENABLE_AI_IMAGE_GENERATION=true
✅ CRON_SECRET
```

#### 3. 手動觸發測試（可選）

```bash
# 訪問 Admin Dashboard
https://wantcar.autos/admin

# 登入後點擊「觸發 Generator」
# 應該看到:
✅ 確認對話框：「目標 10 篇，約需 4-5 分鐘」
✅ 成功提示：「Generator 已在後台啟動！」
✅ 30 秒後自動刷新

# 檢查結果
# 4-5 分鐘後刷新頁面，應該看到 10 篇新文章
```

### 首次自動執行驗證（等到下一個整點）

假設現在是 14:23，等到 15:00 第一次自動執行。

#### 等待執行（15:00）

```bash
# 在 15:05 檢查日誌
vercel logs --since 10m | grep "Generator"

# 預期看到:
[Generator] ⏰ Starting scheduled generator run
[Generator] 📊 Processing 10 articles
[Generator] ✅ Generator execution completed: 10 articles published
[Generator] ⏱️ Execution time: ~4.5 minutes
```

#### 檢查執行結果（15:06）

```bash
# 方法 1: 使用腳本
npx tsx scripts/check-recent-articles.ts

# 預期輸出:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 最近 24 小時的文章統計
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

總文章數: 10 篇
有封面圖: 10 篇
無封面圖: 0 篇

✅ 所有已發布的文章都有封面圖！

# 方法 2: 訪問網站
https://wantcar.autos

# 應該在首頁看到 10 篇新文章
```

### 24 小時監控（第二天同一時間）

#### 檢查執行次數

```bash
# 檢查執行記錄
vercel logs --since 24h | grep "Generator execution completed" | wc -l

# 預期輸出: 24（或接近 24，允許 1-2 次失敗）
```

#### 檢查總產出

```bash
# 檢查最近 24 小時的文章
npx tsx scripts/check-recent-articles.ts

# 預期輸出:
總文章數: 220-240 篇（允許少量失敗）
有封面圖: 220-240 篇
成功率: > 95%
```

#### 檢查品牌分佈

```bash
# 創建檢查腳本（如果還沒有）
cat > scripts/check-brand-distribution.ts << 'EOF'
import { createClient } from '@/lib/supabase'

async function checkBrandDistribution() {
  const supabase = createClient()

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const { data, error } = await supabase
    .from('generated_articles')
    .select('primary_brand')
    .eq('published', true)
    .gte('published_at', yesterday.toISOString())

  if (error) {
    console.error('Error:', error)
    return
  }

  const brandCounts: Record<string, number> = {}
  data.forEach(article => {
    const brand = article.primary_brand
    brandCounts[brand] = (brandCounts[brand] || 0) + 1
  })

  console.log('\n📊 過去 24 小時品牌分佈:\n')
  Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => {
      console.log(`${brand.padEnd(20)} ${count} 篇`)
    })

  const totalBrands = Object.keys(brandCounts).length
  const totalArticles = data.length
  console.log(`\n總計: ${totalArticles} 篇，涵蓋 ${totalBrands} 個品牌`)
}

checkBrandDistribution()
EOF

npx tsx scripts/check-brand-distribution.ts

# 預期輸出:
# 所有主要品牌都應該有文章
# 每個品牌至少 3-4 篇
```

---

## 成功指標

### 第一天（部署後 24 小時）

- [ ] **執行次數**: 23-24 次（允許 1 次失敗）
- [ ] **總產出**: 220-240 篇文章
- [ ] **成功率**: > 95%
- [ ] **執行時間**: 平均 < 270 秒（4.5 分鐘）
- [ ] **零超時錯誤**: 沒有 504 或 500 錯誤
- [ ] **品牌覆蓋**: > 25 個品牌有文章

### 第一周（部署後 7 天）

- [ ] **日均產出**: 220-240 篇/天
- [ ] **周總產出**: 1,540-1,680 篇
- [ ] **成功率**: > 98%
- [ ] **用戶反饋**: 沒有「看不到新文章」的投訴
- [ ] **系統穩定**: 沒有需要手動干預的故障

---

## 問題排查

### 如果執行次數少於 20 次/天

**可能原因：**
1. Vercel Cron 配置未更新
2. 部分執行失敗

**排查步驟：**
```bash
# 1. 檢查 Vercel Cron 配置
vercel env ls | grep schedule

# 2. 檢查失敗日誌
vercel logs --since 24h | grep -i error

# 3. 檢查 Vercel Cron 執行記錄
# 訪問 Vercel Dashboard → Cron Logs
```

### 如果每次產出少於 8 篇

**可能原因：**
1. 源文章不足
2. 去重過濾太嚴格
3. 執行超時（但應該不會發生）

**排查步驟：**
```bash
# 檢查日誌
vercel logs --since 10m | grep "articles processed"
vercel logs --since 10m | grep "duplicate"
vercel logs --since 10m | grep "timeout"
```

### 如果仍然出現超時

**可能原因：**
1. Gemini API 響應變慢
2. 圖片生成太多（DALL-E 延遲）

**緊急調整：**
```typescript
// src/app/api/cron/generator/route.ts
const TIMEOUT_CONFIG = {
  TARGET_ARTICLES: 8,  // 從 10 降到 8
}
```

---

## 回滾計劃

如果新策略出現嚴重問題，可以回滾到之前的配置。

### 回滾步驟

```bash
# 1. 回滾代碼
git revert HEAD
git push origin main

# 2. 或者手動調整配置
# vercel.json
"schedule": "0 1,4,7,10,13,16 * * *"  # 改回 6 次/天

# route.ts
TARGET_ARTICLES: 60  # 改回 60 篇

# 3. 重新部署
git add .
git commit -m "Rollback to previous strategy"
git push origin main
```

**注意：** 回滾後仍會面臨超時問題，需要其他解決方案（如使用背景任務隊列）。

---

## 下一步優化

### 短期（1-2 周內）

1. **動態調整批量大小**
   - 根據實際執行時間自動調整 TARGET_ARTICLES
   - 如果執行時間 < 200 秒，增加到 12 篇
   - 如果執行時間 > 260 秒，降低到 8 篇

2. **智能品牌分配**
   - 分析用戶閱讀數據
   - 熱門品牌增加配額，冷門品牌保證最低配額

3. **執行時段優化**
   - 白天（8:00-22:00）執行頻率提高
   - 凌晨（0:00-6:00）執行頻率降低

### 中期（1-3 個月）

1. **任務隊列系統**
   - 使用 BullMQ 或 Inngest
   - 支持更長時間的任務
   - 更好的錯誤處理和重試機制

2. **實時進度推送**
   - 使用 WebSocket
   - Admin Dashboard 顯示生成進度

3. **A/B 測試**
   - 測試不同批量大小的效果
   - 測試不同執行頻率的用戶體驗

---

## 監控儀表板

### 建議添加的監控指標

```typescript
// 可以在 Admin Dashboard 添加
interface GeneratorMetrics {
  last24Hours: {
    executionCount: number      // 執行次數
    successRate: number          // 成功率
    totalArticles: number        // 總產出
    avgExecutionTime: number     // 平均執行時間
    brandsCovered: number        // 品牌覆蓋數
  }

  lastExecution: {
    timestamp: Date
    articlesGenerated: number
    executionTime: number
    status: 'success' | 'failed'
  }
}
```

---

## 聯繫方式

如果遇到問題：

1. **檢查文檔**
   - `docs/high-frequency-strategy.md` - 策略說明
   - `docs/strategy-comparison.md` - 對比分析
   - `docs/504-timeout-fix.md` - 超時問題

2. **查看日誌**
   ```bash
   vercel logs --follow
   ```

3. **運行診斷腳本**
   ```bash
   npx tsx scripts/check-recent-articles.ts
   ```

---

**檢查清單創建日期**: 2025-11-28
**當前狀態**: ✅ 準備部署
**預計部署時間**: < 5 分鐘
