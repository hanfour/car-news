# Car-News-AI 全面優化 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve production stability, performance, security, and code quality across the car-news-ai platform.

**Architecture:** Phased approach — Phase 1 (performance/reliability), Phase 2 (security), Phase 3 (code refactoring), Phase 4 (cleanup). Each phase is independently deployable.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + pgvector), TypeScript, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-11-project-optimization-design.md`

---

## Chunk 1: Performance & Reliability

### Task 1: Add Database Indexes (Supabase Migration)

**Files:**
- Create: `supabase/migrations/20260312_add_performance_indexes.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 首頁/最新頁查詢加速
CREATE INDEX IF NOT EXISTS idx_articles_published_date
  ON generated_articles(published, published_at DESC);

-- 分類頁查詢加速 (categories 是 text[] 陣列型別)
CREATE INDEX IF NOT EXISTS idx_articles_categories
  ON generated_articles USING GIN(categories);

-- 爬蟲查詢加速
CREATE INDEX IF NOT EXISTS idx_raw_articles_source_type
  ON raw_articles(source_type, created_at DESC);
```

- [ ] **Step 2: Apply migration via Supabase dashboard or CLI**

Run the SQL in the Supabase SQL Editor for the production database.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260312_add_performance_indexes.sql
git commit -m "perf: 新增資料庫效能索引（published_date, categories GIN, source_type）"
```

---

### Task 2: Adjust Homepage Revalidation

**Files:**
- Modify: `src/app/page.tsx:13`

- [ ] **Step 1: Update revalidate value**

In `src/app/page.tsx`, change line 13:

```typescript
// Before:
export const revalidate = 10

// After:
export const revalidate = 60
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "perf: 首頁 revalidate 調整為 60 秒"
```

---

### Task 3: Optimize Search API (Limit ILIKE scope + Add Cache Header)

**Files:**
- Modify: `src/app/api/search/route.ts:50-56`

- [ ] **Step 1: Limit ILIKE to title only and add cache header**

In `src/app/api/search/route.ts`, update the `fallbackSearch` function (around line 50):

```typescript
// Before:
    .or(`title_zh.ilike.%${sanitizedQuery}%,content_zh.ilike.%${sanitizedQuery}%`)

// After:
    .or(`title_zh.ilike.%${sanitizedQuery}%`)
```

Also, in the GET handler, add cache headers to the successful response. Find the `return NextResponse.json(...)` for successful results and replace with:

```typescript
return NextResponse.json(
  { articles: data || [] },
  { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
)
```

Apply this header to both the RPC success response and the fallback success response.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "perf: 搜尋 API 限制 ILIKE 範圍並加 5 分鐘快取"
```

---

### Task 4: Add Timeout to Pressroom Scraper fetch

**Files:**
- Modify: `src/lib/scrapers/pressroom/base.ts:112-125`

- [ ] **Step 1: Add AbortSignal.timeout to fetchPage**

In `src/lib/scrapers/pressroom/base.ts`, update the `fetchPage` method (line ~112):

```typescript
  protected async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.config.userAgent ||
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.text()
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/scrapers/pressroom/base.ts
git commit -m "fix: Pressroom 爬蟲 fetch 加 30 秒超時保護"
```

---

### Task 5: Increase RSS Parser Timeout

**Files:**
- Modify: `src/lib/scraper/rss-parser.ts:5`

- [ ] **Step 1: Update timeout**

In `src/lib/scraper/rss-parser.ts`, line 5:

```typescript
// Before:
  timeout: 10000,

// After:
  timeout: 30000,
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scraper/rss-parser.ts
git commit -m "fix: RSS parser 超時從 10 秒增加到 30 秒"
```

---

### Task 6: Parallel Image Downloads with Chunking

**Files:**
- Modify: `src/lib/storage/image-downloader.ts:220-243`

- [ ] **Step 1: Replace sequential loop with chunk-based parallel**

In `src/lib/storage/image-downloader.ts`, replace the `downloadAndStoreImages` function (lines 220-243):

```typescript
export async function downloadAndStoreImages(
  images: Array<{ url: string; credit: string; caption?: string }>,
  articleId: string
): Promise<Array<{ url: string; credit: string; caption?: string }>> {
  const results: Array<{ url: string; credit: string; caption?: string }> = []
  const CHUNK_SIZE = 3

  for (let i = 0; i < images.length; i += CHUNK_SIZE) {
    const chunk = images.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.allSettled(
      chunk.map(image => downloadAndStoreImage(image.url, articleId, image.credit))
    )

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j]
      if (result.status === 'fulfilled' && result.value) {
        results.push({
          url: result.value.url,
          credit: result.value.credit,
          caption: chunk[j].caption,
        })
      } else {
        const reason = result.status === 'rejected' ? result.reason : 'download failed'
        console.warn(`[Image Storage] Skipping image: ${chunk[j].url} (${reason})`)
      }
    }
  }

  return results
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/image-downloader.ts
git commit -m "perf: 圖片下載改為每 3 張並行處理"
```

---

### Task 7: Fix Generator Race Condition (markRawArticlesAsUsed)

**Files:**
- Modify: `src/lib/utils/deduplication.ts:171-185`

- [ ] **Step 1: Add `.is('used_in_article_id', null)` condition**

In `src/lib/utils/deduplication.ts`, update `markRawArticlesAsUsed` (line ~171):

```typescript
export async function markRawArticlesAsUsed(
  rawArticleIds: string[],
  generatedArticleId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data, error, count } = await supabase
    .from('raw_articles')
    .update({ used_in_article_id: generatedArticleId })
    .in('id', rawArticleIds)
    .is('used_in_article_id', null)
    .select('id', { count: 'exact' })

  if (error) {
    console.error('[Dedup] Failed to mark raw articles as used:', error)
    return false
  }

  if (count !== rawArticleIds.length) {
    console.warn(`[Dedup] Expected to mark ${rawArticleIds.length} articles, but only ${count} were available (rest already claimed)`)
  }

  return true
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/deduplication.ts
git commit -m "fix: markRawArticlesAsUsed 加 null 條件防止競態重複處理"
```

---

### Task 8: Fix Topic Lock Race Condition (use upsert)

**Files:**
- Modify: `src/lib/utils/deduplication.ts:145-166`

- [ ] **Step 1: Replace insert with upsert**

In `src/lib/utils/deduplication.ts`, update `createTopicLock` (line ~145):

```typescript
export async function createTopicLock(
  topicHash: string,
  articleId: string
): Promise<boolean> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('daily_topic_locks')
    .upsert(
      {
        date: today,
        topic_hash: topicHash,
        article_id: articleId
      },
      { onConflict: 'date,topic_hash', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[Topic Lock] Failed to create lock:', error)
    return false
  }

  // Verify we own the lock (ignoreDuplicates silently succeeds even if another process won)
  const { data: lock } = await supabase
    .from('daily_topic_locks')
    .select('article_id')
    .eq('date', today)
    .eq('topic_hash', topicHash)
    .single()

  if (lock?.article_id !== articleId) {
    console.warn(`[Topic Lock] Lock already held by article ${lock?.article_id}, skipping`)
    return false
  }

  return true
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/deduplication.ts
git commit -m "fix: Topic lock 改用 upsert 防止競態條件"
```

---

### Task 9: Fix CRON_SECRET Validation (Pressroom Scraper - fail-closed)

**Files:**
- Modify: `src/app/api/cron/pressroom-scraper/route.ts:17,25-34`

- [ ] **Step 1: Update CRON_SECRET validation to fail-closed**

In `src/app/api/cron/pressroom-scraper/route.ts`, replace the auth block (lines 17, 25-34):

```typescript
// Replace line 17:
const CRON_SECRET = process.env.CRON_SECRET?.trim()

// Replace lines 25-34:
  const authHeader = request.headers.get('authorization')
  const vercelCron = request.headers.get('x-vercel-cron-signature')
  const isVercelCron = !!vercelCron
  const isManualTrigger = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`

  if (!isVercelCron && !isManualTrigger) {
    console.warn('[Pressroom Cron] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/pressroom-scraper/route.ts
git commit -m "fix: Pressroom cron CRON_SECRET 驗證改為 fail-closed"
```

---

## Chunk 2: Security

### Task 10: Add Search API Rate Limiting

**Files:**
- Create: `src/lib/utils/rate-limiter.ts`
- Modify: `src/app/api/search/route.ts`

- [ ] **Step 1: Create rate limiter utility**

Create `src/lib/utils/rate-limiter.ts`:

```typescript
const requestCounts = new Map<string, { count: number; resetTime: number }>()

// Cleanup expired entries every 60 seconds
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now

  for (const [key, entry] of requestCounts) {
    if (now > entry.resetTime) {
      requestCounts.delete(key)
    }
  }
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  cleanup()

  const now = Date.now()
  const entry = requestCounts.get(identifier)

  if (!entry || now > entry.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: maxRequests - entry.count }
}
```

**Note:** This is in-memory rate limiting. On Vercel serverless, each cold start resets the Map, and limits are not shared across instances. This is an acceptable trade-off — it still protects against rapid-fire requests within a single instance lifetime.

- [ ] **Step 2: Add rate limiting to search route**

In `src/app/api/search/route.ts`, add import at top:

```typescript
import { checkRateLimit } from '@/lib/utils/rate-limiter'
```

At the beginning of the GET handler, before any query processing, add:

```typescript
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed, remaining } = checkRateLimit(clientIp, 30)

  if (!allowed) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      {
        status: 429,
        headers: { 'Retry-After': '60' }
      }
    )
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/rate-limiter.ts src/app/api/search/route.ts
git commit -m "feat: 搜尋 API 加 IP 限速（每分鐘 30 次）"
```

---

### Task 11: Fix Login Rate Limit to Fail-Closed

**Files:**
- Modify: `src/lib/admin/rate-limit.ts:57-61`

- [ ] **Step 1: Change fail-open to fail-closed**

In `src/lib/admin/rate-limit.ts`, update lines 57-61:

```typescript
  // Before:
  if (error) {
    console.error('[Rate Limit] Failed to check rate limit:', error)
    // 出錯時保守處理,允許登入
    return { allowed: true, remainingAttempts: 5 }
  }

  // After:
  if (error) {
    console.error('[Rate Limit] Failed to check rate limit:', error)
    return { allowed: false, remainingAttempts: 0 }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin/rate-limit.ts
git commit -m "fix: 登入限速改為 fail-closed（資料庫錯誤時拒絕登入）"
```

---

## Chunk 3: Code Refactoring

### Task 12: Extract Shared Auth Helper

**Files:**
- Create: `src/lib/auth.ts`
- Modify: `src/app/api/articles/[id]/like/route.ts`
- Modify: `src/app/api/articles/[id]/favorite/route.ts`
- Modify: `src/app/api/articles/[id]/share/route.ts`
- Modify: `src/app/api/articles/[id]/report/route.ts`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/comments/[id]/like/route.ts`
- Modify: `src/app/api/comments/[id]/report/route.ts`
- Modify: `src/app/api/comments/[id]/replies/route.ts`

- [ ] **Step 1: Create auth helper**

Create `src/lib/auth.ts`:

```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

export async function createAuthenticatedClient(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Safe to ignore in API routes
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Safe to ignore in API routes
          }
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return { supabase, user, userId: user.id }
}
```

- [ ] **Step 2: Refactor like route as reference implementation**

In `src/app/api/articles/[id]/like/route.ts`, replace the auth cookie setup block (lines ~16-58) in the POST handler with:

```typescript
import { createAuthenticatedClient } from '@/lib/auth'

// In POST handler, replace auth block with:
  const auth = await createAuthenticatedClient(request)
  if (!auth) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }
  const { supabase, userId } = auth
```

Remove the now-unused imports: `cookies`, `createServerClient`, `CookieOptions`.

- [ ] **Step 3: Refactor remaining 7 routes following the same pattern**

Apply the same replacement to each route. Auth requirement per route:

| Route | Auth Type |
|-------|-----------|
| `articles/[id]/favorite/route.ts` | Required (401 if missing) |
| `articles/[id]/share/route.ts` | Optional (`auth?.userId \|\| null`) |
| `articles/[id]/report/route.ts` | Required (401 if missing) |
| `comments/route.ts` (POST) | Required (401 if missing) |
| `comments/[id]/like/route.ts` | Required (401 if missing) |
| `comments/[id]/report/route.ts` | Required (401 if missing) |
| `comments/[id]/replies/route.ts` | Required (401 if missing) |

For **required** auth routes, use the same pattern as Step 2. For **optional** auth (`share`), use:
```typescript
  const auth = await createAuthenticatedClient(request)
  const userId = auth?.userId || null
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/articles/ src/app/api/comments/
git commit -m "refactor: 提取共用 auth helper，移除 8 個 route 中的重複認證程式碼"
```

---

### Task 13: Remove Duplicate cosineSimilarity

**Files:**
- Modify: `src/lib/utils/advanced-deduplication.ts:13-28`

- [ ] **Step 1: Replace local function with import**

In `src/lib/utils/advanced-deduplication.ts`:

1. Add import at top:
```typescript
import { cosineSimilarity } from '@/lib/ai/embeddings'
```

2. Delete the local `cosineSimilarity` function (lines 13-28).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/advanced-deduplication.ts
git commit -m "refactor: 移除重複的 cosineSimilarity，改為 import from embeddings"
```

---

### Task 14: Delete Backup Files

**Files:**
- Delete: `src/middleware.v1.backup.ts`
- Delete: `src/app/api/admin/auth/logout/route.v1.backup.ts`

- [ ] **Step 1: Delete backup files**

```bash
rm src/middleware.v1.backup.ts
rm src/app/api/admin/auth/logout/route.v1.backup.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: 刪除殘留的 .backup.ts 檔案"
```

---

## Chunk 4: Verification & Deployment

### Task 15: Full Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Deploy to Vercel**

Push to main branch to trigger Vercel deployment:

```bash
git push origin main
```

- [ ] **Step 5: Verify Cron Jobs in Vercel Logs**

After deployment, monitor the next scraper and generator cron runs in Vercel logs to confirm:
- Embedding generation uses `gemini-embedding-001` without 404 errors
- Image downloads complete faster (parallel)
- No CRON_SECRET auth issues

---

## Deferred Items (Future Phases)

The following spec items are intentionally deferred to keep this plan focused:

- **Article interaction dedup** (spec 3.3): Existing DB unique constraints already handle this; only needs verification during deployment monitoring, no code changes required
- **Embedding timeout** (15s AbortSignal in generator): Low-priority, Gemini REST API is fast
- **Pressroom config-driven refactor** (merge 5 brand scrapers → generic): Significant refactor, separate plan recommended
- **Admin page split** (1,052 lines → 4 components): UI refactor, separate plan recommended
- **API response format standardization**: Requires frontend audit, separate plan recommended
- **Script consolidation** (85 → ~20): Tooling improvement, separate plan recommended
- **README / PROJECT_STATUS docs update**: Can be done anytime, no code risk
