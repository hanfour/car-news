# AI SEO 優化設計文件

**日期**: 2026-03-12
**目標**: 提升網站在 AI 搜尋引擎（ChatGPT、Perplexity、Google AI Overview）中的可見性
**策略**: 結構化資料 + AI 爬蟲友善 + 頁面 metadata 完善

---

## 1. AI 爬蟲可見性

### 1.1 robots.txt 更新

修改 `src/app/robots.txt/route.ts`：

**新增 AI 爬蟲規則（允許但限速）：**

注意：`Crawl-delay` 非 RFC 9309 標準，GPTBot/PerplexityBot 是否遵守未有文件記載，但作為禮貌性訊號仍有價值。現有全域 `User-agent: *` 的 `Crawl-delay: 1` 保持不變，AI 爬蟲使用較高的 delay 值。

```
User-agent: GPTBot
Crawl-delay: 5

User-agent: PerplexityBot
Crawl-delay: 5

User-agent: ClaudeBot
Crawl-delay: 5

User-agent: anthropic-ai
Crawl-delay: 5
```

**封鎖訓練用途爬蟲：**
```
User-agent: CCBot
Disallow: /
```

注意：不封鎖 `Google-Extended`。雖然它控制 Gemini 訓練資料，但也影響 Vertex AI grounding 和 Google AI Overview 的引用能力。封鎖它與提升 AI 搜尋可見性的目標矛盾。

**移除錯誤的 RSS sitemap 宣告：**
- 刪除 `Sitemap: https://wantcar.autos/feed.xml`（RSS 不是 sitemap 格式，此修正同時解決 Section 3.2 的需求，不需重複操作）

### 1.2 llms.txt

新增 `public/llms.txt`：

```
# 玩咖 WANT CAR

> AI 驅動的繁體中文汽車新聞平台

## 關於本站
玩咖 WANT CAR 是一個 AI 驅動的汽車新聞聚合平台，提供繁體中文的最新汽車資訊。
內容涵蓋電動車、傳統燃油車、品牌動態、產業分析等主題。

## 主要頁面
- [首頁](https://wantcar.autos/) — 最新汽車新聞總覽
- [最新文章](https://wantcar.autos/latest) — 按時間排序的所有文章
- [Toyota 品牌頁](https://wantcar.autos/brand/Toyota) — 品牌專屬新聞（各品牌皆有對應頁面）
- [電動車分類](https://wantcar.autos/category/ev) — 按主題分類的新聞

## 資料格式
- [RSS Feed](https://wantcar.autos/feed.xml) — RSS 2.0，包含最新文章
- [Sitemap](https://wantcar.autos/sitemap.xml) — 完整頁面索引

## 內容特色
- 語言：繁體中文（zh-TW）
- 更新頻率：每小時自動更新
- 來源：聚合 30+ 國際汽車媒體
- 免費閱讀，無付費牆
```

---

## 2. 結構化資料強化

### 前置作業

在 `src/app/layout.tsx` 的 metadata export 加入 `metadataBase`（所有 `alternates`、`openGraph.url`、`twitter.images` 的正確解析都依賴此設定）：

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://wantcar.autos'),
  // ... existing metadata
}
```

### 2.1 文章頁 JSON-LD 補強

修改 `src/app/[year]/[month]/[id]/page.tsx` 的 NewsArticle JSON-LD：

新增欄位：
- `inLanguage: "zh-TW"`
- `url: articleUrl`（完整文章 URL，與 `mainEntityOfPage.@id` 重複但有利於不解析 mainEntityOfPage 的 parser）
- `isAccessibleForFree: true`
- `wordCount`：使用 `article.content_zh.replace(/[-#*_\[\]()>]/g, '').trim().length` 計算（先移除 Markdown 語法字元再計算中文字數）

同時修正 publisher logo 引用：
```typescript
logo: {
  '@type': 'ImageObject',
  url: `${baseUrl}/logo-wide.png`,
  width: 600,
  height: 60
}
```
（Google NewsArticle 要求 publisher logo 寬高比不超過 3:1、高度最大 112px，600x60 符合規範）

### 2.2 首頁/Layout JSON-LD

在 `src/app/layout.tsx` 的 `<body>` 內注入一個 `<script type="application/ld+json">`，使用 `@graph` 陣列包含兩個 schema：

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "玩咖 WANT CAR",
      "url": "https://wantcar.autos",
      "inLanguage": "zh-TW",
      "description": "AI 驅動的繁體中文汽車新聞平台"
    },
    {
      "@type": "Organization",
      "name": "玩咖 WANT CAR",
      "url": "https://wantcar.autos",
      "logo": {
        "@type": "ImageObject",
        "url": "https://wantcar.autos/logo.png",
        "width": 512,
        "height": 512
      }
    }
  ]
}
```

注意：不加入 `SearchAction`（`potentialAction`），因為網站目前沒有 `/search` 頁面路由（只有 `/api/search` API）。若未來新增搜尋頁面再加入。

注入方式：在 layout.tsx 的 `<body>` 開頭加入 `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />`，這是 Next.js App Router server component 中注入 JSON-LD 的標準方式。

### 2.3 品牌/分類頁 metadata

**品牌頁** `src/app/brand/[name]/page.tsx`：

品牌名稱來源：URL 參數 `name` 直接對應 `@/config/brands` 中的品牌名稱（如 `Toyota`、`BMW`）。

新增 `generateMetadata()`：
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brandName = decodeURIComponent(params.name)
  return {
    title: `${brandName} 最新消息 - 玩咖 WANT CAR`,
    description: `${brandName} 最新汽車新聞、車款資訊與產業動態`,
    alternates: { canonical: `/brand/${brandName}` },
    openGraph: {
      title: `${brandName} 最新消息`,
      description: `${brandName} 最新汽車新聞、車款資訊與產業動態`,
      type: 'website',
      siteName: '玩咖 WANT CAR',
      locale: 'zh_TW',
    },
  }
}
```

加入 `CollectionPage` JSON-LD：
```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "{brandName} 最新消息",
  "url": "https://wantcar.autos/brand/{brandName}",
  "description": "{brandName} 最新汽車新聞",
  "inLanguage": "zh-TW",
  "isPartOf": { "@type": "WebSite", "name": "玩咖 WANT CAR", "url": "https://wantcar.autos" }
}
```

**分類頁** `src/app/category/[slug]/page.tsx`：

分類名稱來源：`@/config/categories`（已存在的設定檔，slug → display name 映射）。

同樣新增 `generateMetadata()` 和 `CollectionPage` JSON-LD，格式同品牌頁。

---

## 3. Sitemap 與 RSS 修復

### 3.1 Sitemap 啟用 Google News 標籤

修改 `src/app/sitemap.xml/route.ts`：

**更新 DB 查詢**：現有 `select('id, published_at')` 需加入 `title_zh` 欄位以供 `<news:title>` 使用：
```typescript
.select('id, published_at, title_zh')
```

每篇文章的 `<url>` 內加入：
```xml
<news:news>
  <news:publication>
    <news:name>玩咖 WANT CAR</news:name>
    <news:language>zh</news:language>
  </news:publication>
  <news:publication_date>{ISO 8601 date}</news:publication_date>
  <news:title>{article.title_zh}</news:title>
</news:news>
```

（注意：Google News sitemap 要求 ISO 639 語言碼 `zh`，不是 `zh-TW`）

**加入品牌/分類頁：**
- 品牌列表來源：`@/config/brands` 中的 `POPULAR_BRANDS` 陣列
- 分類列表來源：`@/config/categories` 中的分類定義
- Priority: 0.6，changefreq: daily

**Sitemap index（當文章數 > 1000）：**

路由結構：
- `/sitemap.xml` — sitemap index，列出所有子 sitemap
- `/sitemap-articles.xml?page=1` — 文章子 sitemap（每頁 500 篇）
- `/sitemap-pages.xml` — 靜態頁面 + 品牌 + 分類

檔案結構：所有路由共用 `src/app/sitemap.xml/route.ts` 一個檔案。透過 `request.nextUrl.pathname` 判斷請求的是哪個 sitemap，再搭配 `next.config.ts` 的 `rewrites()` 將 `/sitemap-articles.xml` 和 `/sitemap-pages.xml` 重寫到 `/sitemap.xml`。

實作方式：在 `sitemap.xml/route.ts` 中先查詢文章總數，若 > 1000 則輸出 sitemap index 格式，否則維持現有單一 sitemap。子 sitemap 通過 query parameter `?page=N` 分頁。

### 3.2 RSS Feed 連結修正

在 `src/app/layout.tsx` 的 metadata 加入 RSS 宣告：
```typescript
alternates: {
  types: {
    'application/rss+xml': '/feed.xml'
  }
}
```

（robots.txt 中的 `Sitemap: .../feed.xml` 已在 Section 1.1 中移除）

---

## 4. Logo 與 OG Image

### 4.1 Logo 生成

使用 Node.js 腳本搭配 `sharp` 套件在 build 前生成靜態檔案（非 runtime 生成），輸出到 `public/` 目錄：

- `public/logo.png` — 512x512，深色背景 + 白色「玩咖」文字 + 副標題 "WANT CAR"
- `public/logo-wide.png` — 600x60，橫幅版本（JSON-LD publisher logo 用）
- `public/favicon.png` — 32x32（使用 PNG 格式而非 .ico，Next.js App Router 支援 `favicon.png`）

注意：不使用 .ico 格式，因為 sharp 不原生支援 ico 編碼，且 Next.js App Router 的 `favicon.png` 已被所有現代瀏覽器支援。

**依賴項**：`sharp` 已在 `package.json` 中（用於圖片處理）。腳本放在 `scripts/generate-logo.ts`。

### 4.2 OG Image

新增 `src/app/opengraph-image.tsx`（Next.js App Router convention）：
- 尺寸：1200x630
- 內容：品牌名稱 + 副標題 + 漸層背景
- 此檔案自動作為所有未在 `generateMetadata()` 中設定 `openGraph.images` 的頁面的 fallback OG image
- 文章頁已在 `generateMetadata()` 中設定了 `openGraph.images`（使用封面圖），因此文章頁不受影響

**依賴關係**：Section 2.2 的 Organization logo 引用 `/logo.png`，因此 Logo 生成（Section 4）必須在 JSON-LD 注入（Section 2）之前完成。執行順序已反映此依賴。

---

## 5. HTTP 安全 Headers

在 `next.config.ts` 加入 `headers()` 設定：

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ]
}
```

注意：`Content-Security-Policy` 不在此次範圍內。CSP 需要審計所有第三方資源（Supabase、CDN、analytics），制定不當會破壞網站功能，建議作為獨立任務處理。

---

## 執行順序

1. **區塊 1** — robots.txt + llms.txt（AI 爬蟲可見性）
2. **區塊 5** — HTTP headers（快速完成）
3. **區塊 4** — Logo + OG image + metadataBase（後續區塊依賴 logo 檔案存在）
4. **區塊 2** — JSON-LD + 頁面 metadata
5. **區塊 3** — Sitemap + RSS 修復

每個區塊完成後驗證 build 通過。
