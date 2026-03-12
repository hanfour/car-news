# AI SEO 優化 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升網站在 AI 搜尋引擎（ChatGPT、Perplexity、Google AI Overview）中的可見性

**Architecture:** 透過 robots.txt AI 爬蟲規則、llms.txt、JSON-LD 結構化資料、Google News Sitemap、Logo/OG Image 生成、HTTP 安全 headers 等多管齊下，全面強化 SEO 基礎建設。

**Tech Stack:** Next.js 16 App Router, sharp (image generation), JSON-LD (schema.org), Google News Sitemap XML

**Spec:** `docs/superpowers/specs/2026-03-12-ai-seo-optimization-design.md`

---

## Chunk 1: AI 爬蟲可見性 + HTTP Headers

### Task 1: robots.txt 新增 AI 爬蟲規則

**Files:**
- Modify: `src/app/robots.txt/route.ts`

- [ ] **Step 1: 修改 robots.txt 路由**

在 `src/app/robots.txt/route.ts` 中：

1. 移除 `Sitemap: ${baseUrl}/feed.xml`（RSS 不是 sitemap 格式）
2. 在 `# Block scraping bots` 之後、結尾之前，新增 AI 爬蟲規則和訓練爬蟲封鎖

將 robots.txt 模板字串中的內容替換為：

```typescript
const robotsTxt = `# Robots.txt for WANT CAR (玩咖)
# Generated: ${new Date().toISOString()}

# Allow all search engines to crawl public content
User-agent: *
Allow: /
Allow: /*.webp$
Allow: /*.jpg$
Allow: /*.png$

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /admin

# Disallow authentication pages
Disallow: /auth/

# Allow feed and sitemap
Allow: /feed.xml
Allow: /sitemap.xml

# Crawl rate limit (be gentle with our server)
Crawl-delay: 1

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# Specific bot rules
User-agent: Googlebot
Allow: /
Crawl-delay: 0

User-agent: Bingbot
Allow: /
Crawl-delay: 0

User-agent: Slurp
Allow: /
Crawl-delay: 1

# AI search engine bots (allow but rate-limit)
User-agent: GPTBot
Crawl-delay: 5

User-agent: PerplexityBot
Crawl-delay: 5

User-agent: ClaudeBot
Crawl-delay: 5

User-agent: anthropic-ai
Crawl-delay: 5

# Block training-only crawlers
User-agent: CCBot
Disallow: /

# Block bad bots
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

User-agent: DotBot
Crawl-delay: 10

# Block scraping bots
User-agent: MJ12bot
Disallow: /

User-agent: SemrushBot
Disallow: /api/

User-agent: AhrefsBot
Disallow: /api/
`
```

關鍵變更：
- 移除了 `Sitemap: ${baseUrl}/feed.xml`（只保留 sitemap.xml）
- 新增 GPTBot、PerplexityBot、ClaudeBot、anthropic-ai 的 `Crawl-delay: 5`
- 新增 CCBot `Disallow: /`（封鎖訓練用途爬蟲）

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功，無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.txt/route.ts
git commit -m "feat: robots.txt 新增 AI 爬蟲規則並移除錯誤的 RSS sitemap"
```

---

### Task 2: 新增 llms.txt

**Files:**
- Create: `public/llms.txt`

- [ ] **Step 1: 建立 llms.txt 檔案**

在 `public/llms.txt` 寫入以下內容：

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

- [ ] **Step 2: Commit**

```bash
git add public/llms.txt
git commit -m "feat: 新增 llms.txt 供 AI 搜尋引擎識別"
```

---

### Task 3: HTTP 安全 Headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: 在 next.config.ts 加入 headers() 設定**

在 `next.config.ts` 的 `nextConfig` 物件中，與 `images` 同層加入 `headers`：

```typescript
const nextConfig: NextConfig = {
  images: {
    // ... existing remotePatterns
  },
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
  },
};
```

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: 加入 HTTP 安全 headers (HSTS, X-Frame-Options, etc.)"
```

---

## Chunk 2: Logo 生成 + OG Image + metadataBase

### Task 4: Logo 生成腳本

**Files:**
- Create: `scripts/generate-logo.ts`

**Context:** sharp 已在 package.json 中。sharp 不能直接渲染文字，需要先建構 SVG 再用 sharp 轉為 PNG。

- [ ] **Step 1: 建立 logo 生成腳本**

在 `scripts/generate-logo.ts` 寫入：

```typescript
import sharp from 'sharp'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

async function generateLogos() {
  console.log('Generating logos...')

  // 1. logo.png — 512x512, dark background + white text
  const logoSvg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="64" fill="#1a1a2e"/>
      <text x="256" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="140" font-weight="bold" fill="white">玩咖</text>
      <text x="256" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#6366f1">WANT CAR</text>
    </svg>
  `

  await sharp(Buffer.from(logoSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'logo.png'))

  console.log('✓ logo.png (512x512)')

  // 2. logo-wide.png — 600x60, horizontal banner for JSON-LD publisher
  const logoWideSvg = `
    <svg width="600" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="60" rx="8" fill="#1a1a2e"/>
      <text x="20" y="42" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">玩咖</text>
      <text x="120" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#6366f1">WANT CAR</text>
    </svg>
  `

  await sharp(Buffer.from(logoWideSvg))
    .resize(600, 60)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'logo-wide.png'))

  console.log('✓ logo-wide.png (600x60)')

  // 3. favicon.png — 32x32
  const faviconSvg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1a1a2e"/>
      <text x="16" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">玩</text>
    </svg>
  `

  await sharp(Buffer.from(faviconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'))

  console.log('✓ favicon.png (32x32)')

  console.log('All logos generated!')
}

generateLogos().catch(console.error)
```

- [ ] **Step 2: 執行腳本生成 logo 檔案**

Run: `npx tsx scripts/generate-logo.ts`
Expected: 在 `public/` 目錄下產生 `logo.png`、`logo-wide.png`、`favicon.png`

- [ ] **Step 3: 驗證檔案存在**

Run: `ls -la public/logo.png public/logo-wide.png public/favicon.png`
Expected: 三個檔案都存在且大小合理

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-logo.ts public/logo.png public/logo-wide.png public/favicon.png
git commit -m "feat: 新增 logo 生成腳本與 logo 圖片檔案"
```

---

### Task 5: OG Image 預設圖

**Files:**
- Create: `src/app/opengraph-image.tsx`

**Context:** Next.js App Router 的 `opengraph-image.tsx` 是特殊 convention 檔案，會自動作為未指定 OG image 的頁面的 fallback。使用 `next/og` 的 `ImageResponse`。

- [ ] **Step 1: 建立 opengraph-image.tsx**

在 `src/app/opengraph-image.tsx` 寫入：

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '玩咖 WANT CAR - AI 驅動的玩車資訊平台'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 20,
          }}
        >
          玩咖
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 'bold',
            color: '#6366f1',
            marginBottom: 40,
          }}
        >
          WANT CAR
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
          }}
        >
          AI 驅動的玩車資訊平台
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功，Next.js 自動識別 opengraph-image.tsx

- [ ] **Step 3: Commit**

```bash
git add src/app/opengraph-image.tsx
git commit -m "feat: 新增預設 OG Image (1200x630)"
```

---

### Task 6: layout.tsx 加入 metadataBase + RSS alternates

**Files:**
- Modify: `src/app/layout.tsx:10-20`

- [ ] **Step 1: 修改 layout.tsx 的 metadata export**

在 `src/app/layout.tsx` 中，修改 `metadata` export，加入 `metadataBase` 和 `alternates`：

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://wantcar.autos'),
  title: "玩咖 WANT CAR - 想要車？玩車資訊一網打盡",
  description: "AI 驅動的玩車資訊聚合平台，即時掌握全球車壇動態、新車評測、行業趨勢，用數據洞察汽車產業未來。",
  keywords: "汽車新聞, 玩車資訊, 新車評測, 電動車, 汽車產業, 車壇動態, 玩咖, WANT CAR",
  authors: [{ name: "玩咖 WANT CAR" }],
  openGraph: {
    title: "玩咖 WANT CAR - AI 驅動的玩車資訊平台",
    description: "想要車？從數據到動力，AI 帶你玩懂車界未來",
    type: "website",
    siteName: '玩咖 WANT CAR',
    locale: 'zh_TW',
  },
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
};
```

關鍵變更：
- 新增 `metadataBase: new URL('https://wantcar.autos')`（所有相對 URL 的基礎）
- 新增 `alternates.types` 的 RSS 宣告
- 在 openGraph 中補充 `siteName` 和 `locale`

- [ ] **Step 2: 在 layout.tsx body 注入 WebSite + Organization JSON-LD**

在 `<body>` 開頭（`<LoadingScreen />` 之前），加入 JSON-LD script：

```tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: '玩咖 WANT CAR',
        url: 'https://wantcar.autos',
        inLanguage: 'zh-TW',
        description: 'AI 驅動的繁體中文汽車新聞平台',
      },
      {
        '@type': 'Organization',
        name: '玩咖 WANT CAR',
        url: 'https://wantcar.autos',
        logo: {
          '@type': 'ImageObject',
          url: 'https://wantcar.autos/logo.png',
          width: 512,
          height: 512,
        },
      },
    ],
  }

  return (
    <html lang="zh-TW">
      <head>
        {/* Noto Sans TC + Merriweather - 報導者字型 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Merriweather:wght@400;700&display=swap" />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LoadingScreen />
        {/* ... rest unchanged */}
```

- [ ] **Step 3: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: layout.tsx 加入 metadataBase、RSS alternates 和 JSON-LD"
```

---

## Chunk 3: JSON-LD 強化 + 品牌/分類頁 metadata

### Task 7: 文章頁 JSON-LD 補強

**Files:**
- Modify: `src/app/[year]/[month]/[id]/page.tsx:242-270`

- [ ] **Step 1: 修改文章頁的 structuredData 物件**

在 `src/app/[year]/[month]/[id]/page.tsx` 中，找到 `const structuredData = {` 區塊（約 line 242），替換為：

```typescript
  const wordCount = article.content_zh
    .replace(/[-#*_\[\]()>]/g, '')
    .trim().length

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title_zh,
    description: article.content_zh.slice(0, 150).trim() + '...',
    image: article.cover_image ? [article.cover_image] : [],
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at || article.published_at || article.created_at,
    author: {
      '@type': 'Organization',
      name: '玩咖 WANT CAR',
      url: baseUrl
    },
    publisher: {
      '@type': 'Organization',
      name: '玩咖 WANT CAR',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo-wide.png`,
        width: 600,
        height: 60
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl
    },
    url: articleUrl,
    inLanguage: 'zh-TW',
    isAccessibleForFree: true,
    wordCount,
    articleSection: article.categories?.[0] || 'news',
    keywords: [...(article.brands || []), ...(article.categories || []), ...(article.tags || [])].join(', ')
  }
```

關鍵變更：
- `publisher.logo` 改用 `logo-wide.png` (600x60)，符合 Google NewsArticle 規範
- 新增 `url`、`inLanguage`、`isAccessibleForFree`、`wordCount`

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add src/app/[year]/[month]/[id]/page.tsx
git commit -m "feat: 文章頁 JSON-LD 補強 (publisher logo, wordCount, inLanguage)"
```

---

### Task 8: 品牌頁 metadata + JSON-LD

**Files:**
- Modify: `src/app/brand/[name]/page.tsx`

- [ ] **Step 1: 加入 generateMetadata 和 JSON-LD**

在 `src/app/brand/[name]/page.tsx` 中：

1. 在檔案頂部加入 `Metadata` import：
```typescript
import { Metadata } from 'next'
```

2. 在 `export const revalidate = 60` 之後、`async function getArticlesByBrand` 之前，加入 `generateMetadata`：

```typescript
export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const brandName = decodeURIComponent(name)
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

3. 在 `BrandPage` 函式的 return 中，在 `<div className="flex flex-col...">` 開頭前加入 JSON-LD：

```tsx
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${brand} 最新消息`,
    url: `${baseUrl}/brand/${brand}`,
    description: `${brand} 最新汽車新聞`,
    inLanguage: 'zh-TW',
    isPartOf: { '@type': 'WebSite', name: '玩咖 WANT CAR', url: baseUrl },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* ... existing content unchanged */}
      </div>
    </>
  )
```

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add src/app/brand/[name]/page.tsx
git commit -m "feat: 品牌頁加入 generateMetadata 和 CollectionPage JSON-LD"
```

---

### Task 9: 分類頁 metadata + JSON-LD

**Files:**
- Modify: `src/app/category/[slug]/page.tsx`

- [ ] **Step 1: 加入 generateMetadata 和 JSON-LD**

在 `src/app/category/[slug]/page.tsx` 中：

1. 在檔案頂部加入 `Metadata` import：
```typescript
import { Metadata } from 'next'
```

2. 在 `export const revalidate = 60` 之後、`async function getArticlesByCategory` 之前，加入 `generateMetadata`：

```typescript
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = decodeURIComponent(slug)
  const categoryInfo = getCategoryBySlug(category)
  const displayName = categoryInfo?.name || category

  return {
    title: `${displayName} - 玩咖 WANT CAR`,
    description: `${displayName}相關汽車新聞與產業動態`,
    alternates: { canonical: `/category/${category}` },
    openGraph: {
      title: `${displayName} - 玩咖 WANT CAR`,
      description: `${displayName}相關汽車新聞與產業動態`,
      type: 'website',
      siteName: '玩咖 WANT CAR',
      locale: 'zh_TW',
    },
  }
}
```

3. 在 `CategoryPage` 函式的 return 中，包裹 Fragment 並加入 JSON-LD：

```tsx
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const displayName = categoryInfo?.name || category
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${displayName}`,
    url: `${baseUrl}/category/${category}`,
    description: `${displayName}相關汽車新聞`,
    inLanguage: 'zh-TW',
    isPartOf: { '@type': 'WebSite', name: '玩咖 WANT CAR', url: baseUrl },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* ... existing content unchanged */}
      </div>
    </>
  )
```

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add src/app/category/[slug]/page.tsx
git commit -m "feat: 分類頁加入 generateMetadata 和 CollectionPage JSON-LD"
```

---

## Chunk 4: Sitemap 強化 + 驗證

### Task 10: Sitemap 加入 Google News 標籤 + 品牌/分類頁 + Sitemap Index

**Files:**
- Modify: `src/app/sitemap.xml/route.ts`

**Context:** 現有 sitemap 只有文章和 4 個硬編碼的分類頁。需要加入 `<news:news>` 標籤、動態品牌/分類頁，以及當文章數 > 1000 時的 sitemap index 拆分。

注意：原 spec 建議使用 rewrites + pathname 判斷來路由子 sitemap，但 Next.js rewrite 後 `request.nextUrl.pathname` 會變成目標路徑而非來源路徑，導致判斷失效。改用 `?type=` query parameter 方案，全部在同一個 route.ts 中處理。

另外，現有 sitemap 的 `xmlns:image` namespace 因未使用而有意移除。分類頁 slug 為中文字元（如「新車」），sitemap 中使用 `encodeURIComponent` 會產生 percent-encoded URL，這與分類頁路由 `decodeURIComponent(slug)` 配合正確運作。

- [ ] **Step 1: 完整重寫 sitemap.xml/route.ts**

將 `src/app/sitemap.xml/route.ts` 替換為：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { POPULAR_BRANDS } from '@/config/brands'
import { CATEGORIES } from '@/config/categories'

export const revalidate = 3600

const ARTICLES_PER_PAGE = 500
const SITEMAP_INDEX_THRESHOLD = 1000

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const type = request.nextUrl.searchParams.get('type')
  const page = Number(request.nextUrl.searchParams.get('page') || '1')

  try {
    // Dispatch based on ?type= query parameter
    if (type === 'articles') {
      return generateArticlesSitemap(supabase, baseUrl, page)
    }

    if (type === 'pages') {
      return generatePagesSitemap(baseUrl)
    }

    // Default: /sitemap.xml — check if we need sitemap index
    const { count, error: countError } = await supabase
      .from('generated_articles')
      .select('id', { count: 'exact', head: true })
      .eq('published', true)

    if (countError) {
      console.error('[Sitemap] Error counting articles:', countError)
      return new NextResponse('Error generating sitemap', { status: 500 })
    }

    const totalArticles = count || 0

    if (totalArticles > SITEMAP_INDEX_THRESHOLD) {
      return generateSitemapIndex(baseUrl, totalArticles)
    }

    // Single sitemap (articles + pages combined)
    return generateCombinedSitemap(supabase, baseUrl)

  } catch (error) {
    console.error('[Sitemap] Unexpected error:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}

/** Sitemap index listing all sub-sitemaps */
function generateSitemapIndex(baseUrl: string, totalArticles: number) {
  const totalPages = Math.ceil(totalArticles / ARTICLES_PER_PAGE)
  const now = new Date().toISOString().split('T')[0]

  let sitemaps = ''
  for (let i = 1; i <= totalPages; i++) {
    sitemaps += `  <sitemap>
    <loc>${baseUrl}/sitemap.xml?type=articles&amp;page=${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`
  }
  sitemaps += `  <sitemap>
    <loc>${baseUrl}/sitemap.xml?type=pages</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`

  return xmlResponse(xml)
}

/** Articles sub-sitemap with Google News tags */
async function generateArticlesSitemap(
  supabase: ReturnType<typeof createServiceClient>,
  baseUrl: string,
  page: number
) {
  const offset = (page - 1) * ARTICLES_PER_PAGE

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, published_at, title_zh')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + ARTICLES_PER_PAGE - 1)

  if (error) {
    console.error('[Sitemap] Error fetching articles:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }

  return buildArticlesXml(articles || [], baseUrl)
}

/** Static pages + brand pages + category pages */
function generatePagesSitemap(baseUrl: string) {
  const now = new Date().toISOString().split('T')[0]
  let urls = ''

  // Homepage
  urls += urlEntry(baseUrl, now, 'hourly', '1.0')

  // Latest page
  urls += urlEntry(`${baseUrl}/latest`, now, 'hourly', '0.9')

  // Brand pages
  for (const brand of POPULAR_BRANDS) {
    urls += urlEntry(`${baseUrl}/brand/${encodeURIComponent(brand.name)}`, now, 'daily', '0.6')
  }

  // Category pages
  for (const cat of CATEGORIES) {
    urls += urlEntry(`${baseUrl}/category/${encodeURIComponent(cat.slug)}`, now, 'daily', '0.6')
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return xmlResponse(xml)
}

/** Combined sitemap (when total articles <= threshold) */
async function generateCombinedSitemap(
  supabase: ReturnType<typeof createServiceClient>,
  baseUrl: string
) {
  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, published_at, title_zh')
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[Sitemap] Error fetching articles:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }

  // Build pages section
  const now = new Date().toISOString().split('T')[0]
  let pagesUrls = ''
  pagesUrls += urlEntry(baseUrl, now, 'hourly', '1.0')
  pagesUrls += urlEntry(`${baseUrl}/latest`, now, 'hourly', '0.9')

  for (const brand of POPULAR_BRANDS) {
    pagesUrls += urlEntry(`${baseUrl}/brand/${encodeURIComponent(brand.name)}`, now, 'daily', '0.6')
  }
  for (const cat of CATEGORIES) {
    pagesUrls += urlEntry(`${baseUrl}/category/${encodeURIComponent(cat.slug)}`, now, 'daily', '0.6')
  }

  // Build articles section
  const articlesXmlContent = (articles || []).map(article => {
    const publishedDate = new Date(article.published_at)
    const year = publishedDate.getFullYear()
    const month = String(publishedDate.getMonth() + 1).padStart(2, '0')
    const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))

    let priority = '0.7'
    let changefreq = 'monthly'
    if (daysSincePublished <= 1) { priority = '0.9'; changefreq = 'hourly' }
    else if (daysSincePublished <= 7) { priority = '0.8'; changefreq = 'daily' }
    else if (daysSincePublished <= 30) { priority = '0.7'; changefreq = 'weekly' }

    const escapedTitle = escapeXml(article.title_zh || '')

    return `  <url>
    <loc>${baseUrl}/${year}/${month}/${article.id}</loc>
    <lastmod>${article.published_at.split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <news:news>
      <news:publication>
        <news:name>玩咖 WANT CAR</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${pagesUrls}
${articlesXmlContent}
</urlset>`

  return xmlResponse(xml)
}

/** Build articles XML with news tags */
function buildArticlesXml(
  articles: Array<{ id: string; published_at: string; title_zh: string }>,
  baseUrl: string
) {
  const articlesXml = articles.map(article => {
    const publishedDate = new Date(article.published_at)
    const year = publishedDate.getFullYear()
    const month = String(publishedDate.getMonth() + 1).padStart(2, '0')
    const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))

    let priority = '0.7'
    let changefreq = 'monthly'
    if (daysSincePublished <= 1) { priority = '0.9'; changefreq = 'hourly' }
    else if (daysSincePublished <= 7) { priority = '0.8'; changefreq = 'daily' }
    else if (daysSincePublished <= 30) { priority = '0.7'; changefreq = 'weekly' }

    const escapedTitle = escapeXml(article.title_zh || '')

    return `  <url>
    <loc>${baseUrl}/${year}/${month}/${article.id}</loc>
    <lastmod>${article.published_at.split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <news:news>
      <news:publication>
        <news:name>玩咖 WANT CAR</news:name>
        <news:language>zh</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
    </news:news>
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articlesXml}
</urlset>`

  return xmlResponse(xml)
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
```

注意事項：
- `GET` 函式現在接受 `NextRequest` 參數以讀取 pathname 和 query params
- DB 查詢加入 `title_zh` 欄位
- 所有文章 URL 加入 `<news:news>` 標籤
- `news:language` 使用 `zh`（ISO 639，不是 `zh-TW`）
- 標題使用 `escapeXml` 處理特殊字元
- 品牌頁使用 `POPULAR_BRANDS`，分類頁使用 `CATEGORIES`

- [ ] **Step 2: 驗證 build 通過**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.xml/route.ts
git commit -m "feat: Sitemap 加入 Google News 標籤、品牌/分類頁、sitemap index"
```

---

### Task 11: 全面驗證

**Files:** None (verification only)

- [ ] **Step 1: TypeScript 類型檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 2: 完整 build**

Run: `npx next build`
Expected: Build 成功

- [ ] **Step 3: 驗證生成的檔案**

Run: `ls -la public/logo.png public/logo-wide.png public/favicon.png public/llms.txt`
Expected: 四個檔案都存在

- [ ] **Step 4: Commit 並 push**

```bash
git push origin main
```
