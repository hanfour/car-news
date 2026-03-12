# AI SEO 優化設計文件

**日期**: 2026-03-12
**目標**: 提升網站在 AI 搜尋引擎（ChatGPT、Perplexity、Google AI Overview）中的可見性
**策略**: 結構化資料 + AI 爬蟲友善 + 頁面 metadata 完善

---

## 1. AI 爬蟲可見性

### 1.1 robots.txt 更新

修改 `src/app/robots.txt/route.ts`：

**新增 AI 爬蟲規則（允許但限速）：**
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

User-agent: Google-Extended
Disallow: /
```

**移除錯誤的 RSS sitemap 宣告：**
- 刪除 `Sitemap: https://wantcar.autos/feed.xml`（RSS 不是 sitemap 格式）

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
- [品牌頁](https://wantcar.autos/brand/{brand-name}) — 各品牌專屬新聞
- [分類頁](https://wantcar.autos/category/{category-slug}) — 按主題分類

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

### 2.1 文章頁 JSON-LD 補強

修改 `src/app/[year]/[month]/[id]/page.tsx` 的 NewsArticle JSON-LD：

新增欄位：
- `inLanguage: "zh-TW"`
- `url: articleUrl`（完整文章 URL）
- `isAccessibleForFree: true`
- `wordCount: content.length`（中文字數）

### 2.2 首頁/Layout JSON-LD

在 `src/app/layout.tsx` 注入全域 JSON-LD：

**WebSite schema：**
```json
{
  "@type": "WebSite",
  "name": "玩咖 WANT CAR",
  "url": "https://wantcar.autos",
  "inLanguage": "zh-TW",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://wantcar.autos/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

**Organization schema：**
```json
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
```

### 2.3 品牌/分類頁 metadata

**品牌頁** `src/app/brand/[name]/page.tsx`：
- `generateMetadata()` 產生：
  - title: `{brandName} 最新消息 - 玩咖 WANT CAR`
  - description: `{brandName} 最新汽車新聞、車款資訊與產業動態`
  - canonical URL
  - OpenGraph 完整設定
- 加入 `CollectionPage` JSON-LD

**分類頁** `src/app/category/[slug]/page.tsx`：
- `generateMetadata()` 產生：
  - title: `{categoryName} - 玩咖 WANT CAR`
  - description: `最新{categoryName}相關汽車新聞與深度分析`
  - canonical URL
  - OpenGraph 完整設定
- 加入 `CollectionPage` JSON-LD

---

## 3. Sitemap 與 RSS 修復

### 3.1 Sitemap 啟用 Google News 標籤

修改 `src/app/sitemap.xml/route.ts`：

每篇文章的 `<url>` 內加入：
```xml
<news:news>
  <news:publication>
    <news:name>玩咖 WANT CAR</news:name>
    <news:language>zh-TW</news:language>
  </news:publication>
  <news:publication_date>{ISO 8601 date}</news:publication_date>
  <news:title>{article title}</news:title>
</news:news>
```

將品牌頁和分類頁加入 sitemap（priority 0.6）。

當文章數超過 1000 時，切換為 sitemap index 格式，每 500 篇一個子 sitemap。

### 3.2 RSS Feed 連結修正

- 從 `src/app/robots.txt/route.ts` 移除 `Sitemap: .../feed.xml`
- 在 `src/app/layout.tsx` 的 metadata 加入 `alternates.types`：
  ```typescript
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml'
    }
  }
  ```

---

## 4. Logo 與 OG Image

### 4.1 Logo 生成

使用程式碼生成（Next.js ImageResponse 或 sharp）：
- `public/logo.png` — 512x512，品牌主色 + 「玩咖」文字
- `public/logo-wide.png` — 600x60，JSON-LD publisher logo 用
- `public/favicon.ico` — 32x32 favicon

設計風格：深色背景、白色文字、簡潔現代。

### 4.2 OG Image

新增 `src/app/opengraph-image.tsx`（Next.js App Router convention）：
- 尺寸：1200x630
- 內容：品牌名稱 + 副標題 + 背景圖案
- 作為所有未設定 OG image 的頁面的 fallback

在 `src/app/layout.tsx` 補上：
- `metadataBase: new URL('https://wantcar.autos')`

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

---

## 執行順序

1. **區塊 1** — robots.txt + llms.txt（AI 爬蟲可見性）
2. **區塊 5** — HTTP headers（快速完成）
3. **區塊 4** — Logo + OG image（後續區塊依賴）
4. **區塊 2** — JSON-LD + 頁面 metadata
5. **區塊 3** — Sitemap + RSS 修復

每個區塊完成後驗證 build 通過。
