# WANT CAR 進階功能文件

本文件說明系統中的進階功能、管理工具和自動化腳本。

## 📋 目錄

- [防重機制](#防重機制)
- [SEO 優化](#seo-優化)
- [Admin Dashboard](#admin-dashboard)
- [管理腳本](#管理腳本)
- [定期維護](#定期維護)

---

## 🛡️ 防重機制

### 三層防護系統

系統使用三層防護機制來防止重複文章生成：

#### 1️⃣ Embedding 語義相似度檢測
**檔案**: `src/lib/utils/advanced-deduplication.ts`

- **閾值**: 90% 餘弦相似度
- **檢查範圍**: 最近 3 天同品牌文章
- **原理**: 使用 OpenAI embeddings 比較文章語義

```typescript
const result = await checkEmbeddingSimilarity(
  newEmbedding,    // 新文章的 embedding
  'Tesla',          // 品牌名稱
  3,                // 檢查 3 天內
  0.90              // 90% 閾值
)
```

#### 2️⃣ 品牌頻率限制
- **限制**: 24 小時內最多 3 篇同品牌文章
- **檢查範圍**: 最近 24 小時
- **用途**: 防止品牌文章過度集中

```typescript
const result = await checkBrandFrequency(
  'Tesla',  // 品牌名稱
  24,       // 24 小時窗口
  3         // 最多 3 篇
)
```

#### 3️⃣ 關鍵詞重疊檢測
- **閾值**: 70% Jaccard 相似度
- **檢查範圍**: 最近 2 天同品牌文章
- **原理**: 提取標題中的中文詞、年份、英文品牌/型號

```typescript
const result = await checkKeywordOverlap(
  '2026 Audi R26 F1 發表',  // 新文章標題
  'Audi',                    // 品牌名稱
  2,                         // 檢查 2 天內
  0.70                       // 70% 閾值
)
```

### 綜合防重檢查

生成器會自動執行所有三層檢查：

```typescript
const duplicateResult = await comprehensiveDuplicateCheck({
  title: '新文章標題',
  embedding: [0.1, 0.2, ...],  // 文章 embedding
  brand: 'Tesla'
})

if (duplicateResult.isDuplicate) {
  console.log(`重複原因: ${duplicateResult.reason}`)
  // 跳過此文章
}
```

**整合位置**: `src/app/api/cron/generator/route.ts:344-368`

---

## 🔍 SEO 優化

### Sitemap.xml

**URL**: https://wantcar.autos/sitemap.xml
**檔案**: `src/app/sitemap.xml/route.ts`

**功能**:
- 自動包含所有已發布文章
- 動態優先級（根據文章新鮮度）:
  - 1 天內: priority=0.9, changefreq=hourly
  - 7 天內: priority=0.8, changefreq=daily
  - 30 天內: priority=0.7, changefreq=weekly
  - 30 天後: priority=0.7, changefreq=monthly
- 每小時自動更新 (revalidate=3600)

**包含頁面**:
- 首頁 (priority=1.0)
- 分類頁面 (news, reviews, technology, ev)
- 所有已發布文章

### Robots.txt

**URL**: https://wantcar.autos/robots.txt
**檔案**: `src/app/robots.txt/route.ts`

**功能**:
- 允許主要搜尋引擎爬取
- 禁止 `/api/` 和 `/admin/` 路徑
- 針對不同 bot 設定 crawl-delay:
  - Googlebot, Bingbot: 0 秒（無延遲）
  - 一般 bot: 1 秒
  - 攻擊性爬蟲 (Ahrefs, Semrush): 10 秒或完全禁止
- 指向 sitemap.xml 和 feed.xml

### JSON-LD 結構化資料

**檔案**: `src/app/[year]/[month]/[id]/page.tsx`

每篇文章自動包含 Schema.org NewsArticle 格式：

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "文章標題",
  "datePublished": "2025-11-24T08:00:00Z",
  "author": {
    "@type": "Organization",
    "name": "玩咖 WANT CAR"
  },
  "publisher": {
    "@type": "Organization",
    "name": "玩咖 WANT CAR"
  }
}
```

**效益**:
- Google Rich Results 支援
- 提高 SERP 點擊率
- 語音搜尋優化
- Google News 索引

---

## 📊 Admin Dashboard

### 訪問

**URL**: https://wantcar.autos/admin
**登入**: 使用 Supabase 認證

### Generator Monitor

展開 "Generator Monitor" 面板查看：

- **系統健康狀態**: Tesla 占比、品牌多樣性、超限品牌
- **最近 1 小時**: 生成文章數、品牌分布
- **最近 24 小時**: 品牌分布視覺化、健康指標
- **Raw Articles**: 待處理文章數量和品牌分布

**功能**:
- 一鍵刷新統計
- 手動觸發 Generator
- 視覺化品牌分布（進度條）

### Duplicate Monitor ⭐ 新功能

展開 "Duplicate Monitor" 面板查看：

#### 統計總覽
- 分析文章數量 (過去 7 天)
- 語義重複數量 (>90% 相似度)
- 關鍵詞重複數量 (>70% 重疊)
- 品牌超限數量 (>3 篇/24h)

#### 語義重複檢測
- 顯示相似度百分比
- 並排顯示重複文章標題和品牌
- 一鍵查看文章詳情

#### 關鍵詞重複檢測
- 顯示重疊百分比
- 列出共同關鍵詞（標籤式呈現）
- 快速定位問題文章

#### 品牌頻率超限
- 顯示超限品牌和數量
- 列出最近 5 篇文章
- 方便批次處理

**使用方式**:
1. 點擊 "Scan Now" 執行掃描
2. 查看檢測結果
3. 點擊文章 ID 跳轉到文章管理
4. 使用批次操作下線重複文章

---

## 🛠️ 管理腳本

### 1. SEO 健康檢查

**腳本**: `scripts/seo-health-check.ts`

**功能**:
- 驗證 sitemap.xml 可訪問性和格式
- 檢查 robots.txt 內容
- 驗證文章 JSON-LD 結構化資料
- 檢查 meta tags 完整性

**執行**:
```bash
# 基本檢查
npx tsx scripts/seo-health-check.ts

# 輸出範例:
# ✅ [Sitemap] Sitemap valid with 125 URLs
# ✅ [Robots.txt] Robots.txt valid with sitemap reference
# ✅ [Structured Data] Valid NewsArticle schema
# ✅ [Meta Tags] All essential meta tags present
#
# 🎯 Overall: PASS
```

**應在以下時機執行**:
- 提交到 Google Search Console 前
- 部署到生產環境後
- 每週定期檢查

### 2. 自動清理重複文章

**腳本**: `scripts/auto-clean-duplicates.ts`

**功能**:
- 掃描最近 7 天的文章
- 檢測語義重複（>90%）和關鍵詞重複（>70%）
- 自動下線較新的重複文章（保留最早發布的）
- 生成清理報告

**執行**:
```bash
# 模擬執行（不實際修改）
npx tsx scripts/auto-clean-duplicates.ts

# 正式執行（會實際下線文章）
npx tsx scripts/auto-clean-duplicates.ts --execute
```

**輸出範例**:
```
🔍 掃描語義重複（Embedding Similarity > 90%）...
   檢查 45 篇文章...
   ✓ 發現 2 組語義重複

🔍 掃描關鍵詞重複（Keyword Overlap > 70%）...
   檢查 45 篇文章...
   ✓ 發現 1 組關鍵詞重複

📊 處理重複文章（DRY RUN - 不實際執行）

[組 1/3] 語義重複 (92.3%)
  ✅ 保留: [abc123] Tesla Model 3 2025 發表
  ❌ 下線: [def456] 2025 Tesla Model 3 正式公開

📋 清理報告
  語義重複組: 2
  關鍵詞重複組: 1
  ✅ 保留文章: 3
  ❌ 下線文章: 4
  📊 重複率: 57.1%
```

**建議執行頻率**:
- 每週執行一次（週日晚上）
- 發現大量重複時立即執行
- 可設定 cron job 自動執行

### 3. 分析重複文章組

**腳本**: `scripts/analyze-duplicate-group.ts`

**功能**:
- 深度分析一組可疑的重複文章
- 計算兩兩相似度矩陣（標題 + 內容）
- 推薦保留哪篇文章
- 列出需要下線的文章

**執行**:
```bash
npx tsx scripts/analyze-duplicate-group.ts <id1> <id2> <id3>

# 範例
npx tsx scripts/analyze-duplicate-group.ts FVru2Op M6aEo9Q fCHalM5
```

### 4. 批次下線文章

**腳本**: `scripts/unpublish-duplicates.ts`

**功能**:
- 批次將文章設為 unpublished
- 保留文章在資料庫（可恢復）

**執行**:
```bash
npx tsx scripts/unpublish-duplicates.ts <id1> <id2> <id3>

# 範例
npx tsx scripts/unpublish-duplicates.ts abc123 def456 ghi789
```

### 5. 修復封面圖

**腳本**: `scripts/fix-critical-covers.ts`

**功能**:
- 掃描封面圖 < 10KB 的文章
- 自動生成並替換 AI 封面圖
- 優先使用 image variation（保持車輛外觀）

**執行**:
```bash
npx tsx scripts/fix-critical-covers.ts
```

---

## 🔄 定期維護

### 每日檢查

```bash
# 1. 檢查 Generator 執行狀況
# 登入 Admin Dashboard → Generator Monitor

# 2. 快速掃描重複（如果有異常）
npx tsx scripts/auto-clean-duplicates.ts
```

### 每週維護

```bash
# 1. SEO 健康檢查
npx tsx scripts/seo-health-check.ts

# 2. 清理重複文章
npx tsx scripts/auto-clean-duplicates.ts --execute

# 3. 檢查重複監控
# 登入 Admin Dashboard → Duplicate Monitor → Scan Now

# 4. 檢查 Google Search Console
# 查看索引狀況、搜尋效能、Core Web Vitals
```

### 每月檢查

```bash
# 1. 分析 Generator 統計
# Admin Dashboard → Generator Monitor
# 檢查品牌多樣性、Tesla 占比趨勢

# 2. 審核封面圖品質
npx tsx scripts/fix-critical-covers.ts

# 3. Google Search Console 深度分析
# 搜尋查詢分析、內部連結優化

# 4. 調整防重參數（如需要）
# 編輯 src/lib/utils/advanced-deduplication.ts
# 調整閾值: embedding 90%, keyword 70%, brand 3/24h
```

---

## 📈 效能監控

### 關鍵指標

#### 防重效果
- **目標**: 重複率 < 5%
- **監控**: 每週執行 auto-clean-duplicates
- **調整**: 如重複率 > 10%，考慮提高閾值

#### SEO 表現
- **目標**:
  - Google 索引率 > 95%
  - 平均 CTR > 2%
  - Core Web Vitals 全綠
- **監控**: Google Search Console
- **頻率**: 每週檢查一次

#### 品牌多樣性
- **目標**:
  - Tesla 占比 < 30%
  - 每日至少 8 個不同品牌
  - 無品牌超過 3 篇/24h
- **監控**: Admin Dashboard → Generator Monitor
- **頻率**: 每天檢查

---

## 🚨 故障排除

### 問題：重複文章仍然產生

**診斷**:
```bash
# 1. 檢查防重機制是否啟用
# 查看 generator logs 是否有 "Duplicate detected" 訊息

# 2. 手動測試防重
npx tsx -e "
import { comprehensiveDuplicateCheck } from './src/lib/utils/advanced-deduplication'
// 測試特定文章
"

# 3. 檢查 embedding 是否正確生成
# 查看資料庫 generated_articles.content_embedding 欄位
```

**解決方案**:
1. 確認 `content_embedding` 有正確儲存
2. 檢查閾值是否太寬鬆（建議: embedding 90%, keyword 70%）
3. 確認 Topic Lock 正常運作

### 問題：Sitemap 無法訪問

**診斷**:
```bash
curl -I https://wantcar.autos/sitemap.xml
# 應返回 200 OK 和 Content-Type: application/xml
```

**解決方案**:
1. 檢查 `src/app/sitemap.xml/route.ts` 是否存在
2. 確認部署成功
3. 清除 CDN 快取（如有使用）

### 問題：Duplicate Monitor 無資料

**診斷**:
```bash
# 檢查 API endpoint
curl https://wantcar.autos/api/admin/duplicate-monitor \
  -H "Cookie: your-session-cookie"
```

**解決方案**:
1. 確認已登入 Admin
2. 檢查最近 7 天是否有文章
3. 確認文章有 `content_embedding` 欄位

---

## 📚 相關文件

- [Google Search Console 設定指南](./google-search-console-setup.md)
- [API 文件](./api-documentation.md)（如有）
- [部署指南](./deployment.md)（如有）

---

**最後更新**: 2025-11-25
**維護者**: WANT CAR 技術團隊
