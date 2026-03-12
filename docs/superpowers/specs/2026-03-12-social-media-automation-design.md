# 社群媒體自動化 + Admin 管理介面設計文件

**日期**: 2026-03-12
**目標**: 文章生成後自動建立/發布社群貼文，並提供 Admin UI 管理介面
**範圍**: Facebook + Instagram + Threads

---

## 現有程式碼基礎

以下元件已完成，本次設計建立在這些基礎之上：

- `src/lib/social/meta-client.ts` — Facebook/Instagram API 客戶端
- `src/lib/social/threads-client.ts` — Threads API 客戶端
- `src/lib/social/content-generator.ts` — AI 貼文內容生成（Claude）
- `src/app/api/admin/social-posts/route.ts` — 建立/查詢貼文 API
- `src/app/api/admin/social-posts/publish/route.ts` — 發布貼文 API
- `supabase/migrations/20251123_add_social_posts.sql` — social_posts + meta_credentials 表
- `supabase/migrations/20260312_add_threads_user_id.sql` — threads_user_id 欄位

---

## 1. 自動化發文流程

### 1.1 觸發時機

在 `src/app/api/cron/generator/route.ts` 中，當文章成功儲存到 `generated_articles` 後，呼叫新函式 `createSocialPostsForArticle()` 為每篇新文章建立社群貼文。

### 1.2 新增模組：`src/lib/social/auto-publisher.ts`

此模組封裝自動發文邏輯，由 generator cron 呼叫：

```typescript
export async function createSocialPostsForArticle(article: {
  id: string
  title_zh: string
  content_zh: string
  cover_image?: string | null
}): Promise<void>
```

流程：
1. 計算文章 URL（從 `published_at` 取 year/month + id）
2. 呼叫 `generateMultiPlatformContent()` 生成 3 平台貼文內容
3. 在 `social_posts` 表為每個平台建立一筆記錄
4. 檢查 `SOCIAL_AUTO_PUBLISH` 環境變數：
   - `true`：直接呼叫 `publishSocialPost()` 發布，狀態設為 `posted` 或 `failed`
   - `false`（預設）：狀態設為 `pending`，等待 Admin UI 手動審核

### 1.3 新增函式：`publishSocialPost()`

在 `auto-publisher.ts` 中，抽取現有 `publish/route.ts` 的發文邏輯為可重用函式：

```typescript
export async function publishSocialPost(postId: string): Promise<{
  success: boolean
  postUrl?: string
  error?: string
}>
```

此函式：
1. 從 `social_posts` 取得貼文資料
2. 從 `meta_credentials` 取得對應平台認證
3. 呼叫 `formatPostContent()` 格式化內容
4. 呼叫對應平台 API 發布
5. 更新 `social_posts` 狀態（`posted` + `post_url` 或 `failed` + `error_message`）

`publish/route.ts` 改為呼叫此函式，避免重複程式碼。

### 1.4 錯誤處理

- 社群貼文建立/發布失敗**不應**阻斷文章生成流程
- 所有錯誤以 `console.error` 記錄，並將 `social_posts` 狀態設為 `failed`
- 在 generator cron 中使用 try-catch 包裹整個社群發文區塊

### 1.5 環境變數

```
SOCIAL_AUTO_PUBLISH=true|false  # 預設 false（需審核模式）
```

不需要新增其他環境變數，平台認證已在 `meta_credentials` 表中管理。

---

## 2. Admin 管理介面

### 2.1 UI 位置

在現有 `src/app/admin/page.tsx` 中新增「社群貼文」展開區塊，使用與現有「生成器統計」和「重複偵測」相同的展開/收合模式：

```
[📱 社群貼文管理] ← 點擊展開/收合
```

### 2.2 介面元素

展開後顯示：

**狀態統計列**：
- pending 數量（黃色）、posted 數量（綠色）、failed 數量（紅色）

**篩選列**：
- 狀態篩選：全部 | 待審核 | 已發布 | 失敗
- 平台篩選：全部 | Facebook | Instagram | Threads

**貼文列表**：每筆貼文顯示一行：
- 平台 icon（FB/IG/TH）
- 內容預覽（前 60 字）
- 關聯文章標題（連結到文章頁）
- 狀態標籤（pending/posted/failed）
- 時間（建立時間或發布時間）
- 操作按鈕：
  - pending → 「發布」按鈕
  - failed → 「重試」按鈕 + 錯誤訊息 tooltip
  - posted → 「查看」連結（連到 post_url）

**批量操作**：
- 「一鍵發布所有待審核」按鈕（僅 pending 狀態 > 0 時顯示）

### 2.3 API 需求

現有 API 已足夠：
- `GET /api/admin/social-posts` — 取得貼文列表（需加入 status/platform query 篩選）
- `POST /api/admin/social-posts/publish` — 發布單篇貼文

需新增：
- `POST /api/admin/social-posts/batch-publish` — 批量發布所有 pending 貼文

### 2.4 新增 API：batch-publish

`src/app/api/admin/social-posts/batch-publish/route.ts`：

```typescript
POST /api/admin/social-posts/batch-publish
```

流程：
1. 查詢所有 `status = 'pending'` 的貼文
2. 依序呼叫 `publishSocialPost()` 發布每篇
3. 回傳結果摘要：`{ total, published, failed, results: [...] }`

### 2.5 GET API 篩選擴充

修改 `src/app/api/admin/social-posts/route.ts` 的 GET handler，新增 query 參數：
- `status`：篩選狀態（pending | posted | failed）
- `platform`：篩選平台（facebook | instagram | threads）

---

## 3. Generator Cron 整合

### 3.1 修改位置

`src/app/api/cron/generator/route.ts` 中，在文章成功插入 `generated_articles` 後（DB insert 成功、圖片處理完成），加入：

```typescript
// 建立社群貼文（不阻斷主流程）
try {
  await createSocialPostsForArticle({
    id: articleId,
    title_zh: article.title_zh,
    content_zh: article.content_zh,
    cover_image: coverImageUrl,
  })
} catch (socialError) {
  console.error('[Generator] Social post creation failed:', socialError)
  // 不影響文章生成流程
}
```

### 3.2 時間預算

Generator cron 有 5 分鐘限制。社群貼文生成（Claude AI）約需 3-5 秒/平台，3 平台約 10-15 秒。自動發布（API 呼叫）每平台約 2-3 秒。

在 generator 的時間預算檢查中，如果剩餘時間 < 30 秒則跳過社群貼文建立。

---

## 執行順序

1. **auto-publisher.ts** — 新增自動發文模組（核心邏輯）
2. **publish/route.ts** — 重構為呼叫 publishSocialPost()
3. **social-posts/route.ts** — GET API 加入篩選
4. **batch-publish/route.ts** — 新增批量發布 API
5. **generator/route.ts** — 整合社群發文
6. **admin/page.tsx** — 新增社群貼文管理 UI

每步完成後驗證 build 通過。
