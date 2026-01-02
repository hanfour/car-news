# 官方 Pressroom 爬蟲規劃

## 概述

爬取汽車品牌官方新聞室的新聞稿與高畫質圖片，確保合法使用官方素材。

## 品牌官方 Pressroom 調查結果

### Tier 1：結構清晰，易於爬取

| 品牌 | 官方 Pressroom URL | 圖片資源 | 爬取難度 |
|------|-------------------|----------|----------|
| **Lexus** | [pressroom.lexus.com](https://pressroom.lexus.com) | Images & Videos 區塊 | ⭐ 簡單 |
| **Toyota** | [pressroom.toyota.com](https://pressroom.toyota.com) | Images & Videos 區塊 | ⭐ 簡單 |
| **BMW** | [press.bmwgroup.com/global](https://www.press.bmwgroup.com/global) | Photos、TV Footage、Videos | ⭐ 簡單 |
| **Audi** | [audi-mediacenter.com](https://www.audi-mediacenter.com/en) | MediaInfos、Images、Videos | ⭐ 簡單 |
| **Porsche** | [newsroom.porsche.com](https://newsroom.porsche.com/en.html) | Photos、Videos、NewsTV | ⭐ 簡單 |
| **Ford** | [media.ford.com](https://media.ford.com) | Albums、Images、Videos | ⭐ 簡單 |

### Tier 2：需要額外處理

| 品牌 | 官方 Pressroom URL | 備註 | 爬取難度 |
|------|-------------------|------|----------|
| **Mercedes-Benz** | [media.mercedes-benz.com](https://media.mercedes-benz.com) | SPA 架構，需 JS 渲染 | ⭐⭐ 中等 |
| **Hyundai** | [hyundainews.com](https://www.hyundainews.com) | SPA 架構，需 JS 渲染 | ⭐⭐ 中等 |
| **Volvo** | [volvocars.com/intl/media/](https://www.volvocars.com/intl/media/) | 403 Forbidden，可能需認證 | ⭐⭐⭐ 困難 |

### Tier 3：中國品牌

| 品牌 | 官方 Pressroom URL | 備註 |
|------|-------------------|------|
| **BYD** | [en.byd.com/newsroom/](https://en.byd.com/newsroom/) | 美國站 |
| **BYD UK** | [bydukmedia.com](https://bydukmedia.com/) | 英國站，較完整 |
| **NIO** | [nio.com/news](https://www.nio.com/news) | 有 Media Library |
| **Firefly (NIO)** | [firefly.world/news](https://www.firefly.world/news) | NIO 子品牌 |

### Tier 4：特殊情況

| 品牌 | 情況 | 替代方案 |
|------|------|----------|
| **Tesla** | 無傳統 Pressroom | [ir.tesla.com/press](https://ir.tesla.com/press) + [tesla.com/blog](https://www.tesla.com/blog) |

---

## 技術架構

### 爬蟲策略

```
┌─────────────────────────────────────────────────────────────┐
│                    Pressroom Scraper                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  RSS/Feed    │    │  HTML Parser │    │  API Client  │  │
│  │  Scraper     │    │  (Cheerio)   │    │  (REST/JSON) │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Press Article  │                      │
│                    │  Normalizer     │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐           │
│         │                   │                   │           │
│  ┌──────▼───────┐   ┌───────▼──────┐   ┌───────▼──────┐   │
│  │  Raw Article │   │ Image URLs   │   │  Metadata    │   │
│  │  (Supabase)  │   │ (Download)   │   │  (Brand/Date)│   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 資料模型

```typescript
interface PressroomArticle {
  // 來源資訊
  source: string           // 'pressroom.lexus.com'
  sourceType: 'official'   // 標記為官方來源
  brand: string            // 'Lexus'

  // 文章內容
  url: string              // 原始 URL
  title: string            // 英文標題
  content: string          // 文章內容
  publishedAt: Date        // 發布時間

  // 圖片資源（官方高畫質）
  images: Array<{
    url: string            // 原始圖片 URL
    resolution?: string    // '1920x1080'
    caption?: string       // 圖片說明
    credit: string         // 'Lexus Official'
  }>

  // 標籤
  tags?: string[]          // ['RZ', 'Electric', 'F Sport']
  category?: string        // 'Product', 'Corporate'
}
```

---

## 實作計畫

### Phase 1：核心框架（1-2 週）

1. **建立 Pressroom Scraper 基礎架構**
   - `src/lib/scrapers/pressroom/base.ts` - 基礎爬蟲類別
   - `src/lib/scrapers/pressroom/types.ts` - 型別定義
   - `src/lib/scrapers/pressroom/index.ts` - 統一匯出

2. **實作第一個品牌（Lexus/Toyota）**
   - 解析新聞列表頁
   - 提取文章內容
   - 下載官方高畫質圖片

3. **整合現有系統**
   - 修改 `raw_articles` 表，新增 `source_type` 欄位
   - 優先使用官方圖片，無官方圖片時才 AI 生成

### Phase 2：擴展品牌（2-3 週）

4. **新增更多品牌爬蟲**
   - BMW Group (BMW, MINI)
   - Audi
   - Porsche
   - Ford

5. **處理 SPA 網站**
   - 使用 Puppeteer/Playwright 處理 JS 渲染
   - Mercedes-Benz
   - Hyundai

### Phase 3：中國品牌（1 週）

6. **新增中國品牌**
   - BYD
   - NIO
   - XPeng (如有官方 Pressroom)

---

## 合法性考量

### 使用授權

官方 Pressroom 圖片通常包含以下授權聲明：

> "All materials on this site are for **editorial use only**. The use of these materials for advertising, marketing or any other commercial purpose is prohibited."
> — Lexus Pressroom

**結論**：
- ✅ 新聞報導用途（Editorial Use）= 合法
- ❌ 廣告/商業用途 = 不合法

我們作為**新聞編輯網站**，屬於 Editorial Use，可以合法使用。

### 必要標註

所有官方圖片必須標註來源：
```
圖片來源：Lexus 官方
圖片來源：BMW 官方
```

---

## Cron 排程

```
# 官方 Pressroom 爬蟲（每 6 小時）
0 */6 * * * /api/cron/pressroom-scraper

# 現有第三方新聞爬蟲（每 4 小時）
0 */4 * * * /api/cron/scraper
```

### 優先順序邏輯

```typescript
// 文章生成時的圖片選擇邏輯
function selectCoverImage(sources: RawArticle[]) {
  // 1. 優先：官方 Pressroom 圖片
  const officialSource = sources.find(s => s.source_type === 'official')
  if (officialSource?.image_url) {
    return {
      url: officialSource.image_url,
      credit: `${officialSource.brand} 官方`
    }
  }

  // 2. 次選：白名單內的第三方圖片
  const whitelistedSource = sources.find(s =>
    s.image_url && isLegalImageSource(s.image_url).isLegal
  )
  if (whitelistedSource?.image_url) {
    return {
      url: whitelistedSource.image_url,
      credit: whitelistedSource.source
    }
  }

  // 3. 備選：AI 生成
  return generateAIImage(sources)
}
```

---

## 預期效益

| 指標 | 現況 | 預期 |
|------|------|------|
| 官方圖片覆蓋率 | 0% | 60-70% |
| 圖片與車款匹配度 | 中等（AI 生成） | 高（官方圖） |
| 法律風險 | 低（AI 生成安全） | 更低（官方授權） |
| 圖片品質 | 高（AI 1792x1024） | 更高（官方 4K） |

---

## 下一步

1. [ ] 確認要優先支援的品牌列表
2. [ ] 建立 Pressroom Scraper 基礎架構
3. [ ] 實作 Lexus/Toyota Pressroom 爬蟲
4. [ ] 測試並驗證圖片品質
5. [ ] 整合到現有文章生成流程
