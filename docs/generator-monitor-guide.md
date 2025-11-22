# Generator Monitor 使用指南

## 功能概述

Generator Monitor 是一個整合在 Admin 後台的即時監控工具，用於追蹤和管理文章生成器的運行狀態。

## 訪問方式

1. 登入 Admin 後台：`https://wantcar.autos/admin`
2. 找到「Generator Monitor」區塊
3. 點擊展開查看詳細資訊

## 主要功能

### 1. 健康狀態指示器

顯示品牌多樣性健康度，基於 Tesla 文章佔比：

- 🟢 **HEALTHY**：Tesla < 50% （正常）
- 🟡 **WARNING**：Tesla 50-80% （需注意）
- 🔴 **CRITICAL**：Tesla > 80% （品牌過於集中）

### 2. 即時統計數據

**最近 1 小時**
- 生成文章總數
- 品牌分布
- 最新5篇文章列表
- 配額違規警告（單一品牌 > 3篇/小時）

**最近 24 小時**
- 總生成數
- 完整品牌分布

**最近 3 天**
- 長期趨勢分析
- 品牌多樣性追蹤

**Raw Articles 待處理池**
- 可用原始文章數量
- 各品牌 raw articles 分布

### 3. 手動觸發功能

**Trigger Generator** 按鈕：
- 立即執行文章生成流程
- 會顯示確認對話框防止誤觸
- 執行後顯示生成結果：
  - 生成文章數
  - 發布文章數
- 自動刷新統計數據

### 4. 刷新功能

**Refresh** 按鈕：
- 即時更新所有統計數據
- 無需重新載入頁面

## 品牌配額機制

### MAX_ARTICLES_PER_BRAND = 3

每次執行 generator，每個品牌最多生成 **3 篇文章**，確保品牌多樣性。

### 品牌輪換策略

優先品牌清單每天自動輪換：
```
Tesla, BYD, Mercedes-Benz, BMW, Audi, Volkswagen,
Toyota, Honda, Hyundai, Kia, Ford, Chevrolet,
Porsche, Ferrari, Lamborghini, NIO, XPeng, Li Auto
```

輪換算法：`dayOfYear % totalBrands`

## API 端點

### GET /api/admin/generator-stats

**認證**：需要 admin_token cookie

**回應範例**：
```json
{
  "lastHour": {
    "count": 15,
    "brands": [
      { "brand": "Tesla", "count": 3 },
      { "brand": "BMW", "count": 3 },
      { "brand": "Mercedes-Benz", "count": 2 }
    ],
    "articles": [...]
  },
  "last24h": {
    "count": 72,
    "brands": [...]
  },
  "last3days": {
    "count": 180,
    "brands": [...]
  },
  "rawArticles": {
    "count": 787,
    "brands": [...]
  },
  "health": {
    "status": "healthy",
    "teslaPercentage": 35.2,
    "uniqueBrands": 12,
    "brandsOverQuota": []
  }
}
```

### POST /api/admin/trigger-generator

**認證**：需要 admin_token cookie

**回應範例**：
```json
{
  "success": true,
  "message": "Generator triggered successfully",
  "result": {
    "generated": 15,
    "published": 15
  }
}
```

## 故障排除

### 問題：Health Status 顯示 CRITICAL

**可能原因**：
1. Tesla 新聞來源較多
2. 其他品牌 raw_articles 不足
3. 相似度過濾過於嚴格

**解決方案**：
1. 檢查 Raw Articles 品牌分布
2. 手動觸發一次 generator 觀察結果
3. 查看 Vercel Logs 確認過濾邏輯

### 問題：Trigger Generator 失敗

**檢查項目**：
1. 是否已登入 Admin
2. CRON_SECRET 環境變數是否正確
3. 查看瀏覽器 Console 錯誤訊息
4. 檢查 Vercel Logs

### 問題：統計數據不更新

**解決方法**：
1. 點擊 Refresh 按鈕
2. 清除瀏覽器快取
3. 確認 API 端點回應正常

## 技術實作

### 檔案結構
```
src/
├── app/
│   ├── admin/
│   │   └── page.tsx           # Admin Dashboard (含 Generator Monitor UI)
│   └── api/
│       └── admin/
│           ├── generator-stats/
│           │   └── route.ts   # 統計 API
│           └── trigger-generator/
│               └── route.ts   # 手動觸發 API
└── lib/
    └── utils/
        └── brand-extractor.ts # 品牌識別與過濾邏輯
```

### 關鍵程式碼位置

**品牌配額限制**：`src/app/api/cron/generator/route.ts:L123-L128`
```typescript
const MAX_ARTICLES_PER_BRAND = 3

if (brandProcessedCount >= MAX_ARTICLES_PER_BRAND) {
  console.log(`[${brand}] ⏭️  Skipping - reached max quota`)
  continue
}
```

**品牌輪換邏輯**：`src/app/api/cron/generator/route.ts:L107-L114`

**健康狀態計算**：`src/app/api/admin/generator-stats/route.ts:L82-L93`

## 最佳實踐

1. **定期檢查**：每天查看一次 Health Status
2. **品牌多樣性**：保持 Tesla < 50% 為理想狀態
3. **Raw Articles**：確保各品牌都有足夠的 raw articles
4. **手動觸發**：僅在測試或緊急情況下使用

## 更新日誌

### 2024-11-22
- ✅ 新增 Generator Monitor 功能
- ✅ 新增健康狀態指示器
- ✅ 新增手動觸發功能
- ✅ 新增即時統計數據
- ✅ 新增品牌配額上限 (MAX_ARTICLES_PER_BRAND = 3)
- ✅ 修復 Mercedes 品牌名稱統一問題
