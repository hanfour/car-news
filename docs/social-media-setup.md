# 社群媒體發文功能設置指南

## 功能概述

自動生成並發布文章到 Facebook、Instagram 和 Threads，採用**手動批准**工作流程。

## 架構設計

```
文章生成 → AI 生成摘要 → 加入待審核隊列 → 管理員批准 → 發布到社群平台
```

### 核心理念 (Linus 視角)

**數據結構優先**：
- `generated_articles` → `social_posts` 的清晰關係
- 狀態機：`pending` → `approved` → `posted` / `failed`
- 沒有複雜的中間層，沒有不必要的抽象

**消除特殊情況**：
- 三個平台統一接口：`PostParams` → `PostResult`
- 摘要生成統一流程，平台差異僅在字數限制
- 錯誤處理一致：失敗直接記錄到 `error_message`

**實用主義**：
- 第一版不做自動重試（手動重試更可控）
- 第一版不做定時發文（手動批准已經是門檻）
- 第一版不做圖片上傳（使用 link preview 即可）

## 前置要求

### 1. Meta Developer App 設置

#### Step 1: 創建 Meta App

1. 前往 [Meta for Developers](https://developers.facebook.com/)
2. 點擊「My Apps」→「Create App」
3. 選擇 App Type：「Business」
4. 填寫 App 名稱：`WantCar News Publisher`

#### Step 2: 配置 Facebook Login

1. 在 App Dashboard，點擊「Add Product」
2. 選擇「Facebook Login」→「Set Up」
3. 選擇平台：「Web」
4. 設置 Valid OAuth Redirect URIs：
   ```
   https://wantcar.autos/auth/callback
   https://localhost:3000/auth/callback
   ```

#### Step 3: 配置 Pages API

1. 在 App Dashboard，點擊「Add Product」
2. 選擇「Pages」→「Set Up」
3. 需要的權限：
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`

#### Step 4: 配置 Instagram Basic Display API

1. 在 App Dashboard，點擊「Add Product」
2. 選擇「Instagram」→「Set Up」
3. 需要的權限：
   - `instagram_basic`
   - `instagram_content_publish`

#### Step 5: 配置 Threads API

1. 在 App Dashboard，點擊「Add Product」
2. 選擇「Threads」→「Set Up」
3. 需要的權限：
   - `threads_basic`
   - `threads_content_publish`

### 2. 獲取 Access Tokens

#### 獲取 Page Access Token

1. 使用 [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. 選擇你的 App
3. 獲取 User Access Token with permissions:
   - `pages_show_list`
   - `pages_manage_posts`
4. 發送請求：`GET /me/accounts`
5. 複製你的 Page 的 `access_token` 和 `id`

#### 獲取 Instagram Business Account ID

1. 在 Graph API Explorer
2. 發送請求：`GET /{page-id}?fields=instagram_business_account`
3. 複製 `instagram_business_account.id`

#### 轉換為 Long-Lived Token

使用以下 API 將 Short-Lived Token 轉換為 Long-Lived Token（60天）：

```bash
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```

### 3. 資料庫設置

執行 migration：

```bash
# 本地開發環境
psql $DATABASE_URL -f supabase/migrations/20251123_add_social_posts.sql

# 或使用 Supabase CLI
npx supabase db push
```

### 4. 配置 Credentials

在 Supabase，手動插入 credentials：

```sql
-- Facebook Page
INSERT INTO meta_credentials (
  platform,
  access_token,
  page_id,
  is_active
) VALUES (
  'facebook',
  'YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN',
  'YOUR_PAGE_ID',
  true
);

-- Instagram
INSERT INTO meta_credentials (
  platform,
  access_token,
  instagram_account_id,
  is_active
) VALUES (
  'instagram',
  'YOUR_LONG_LIVED_ACCESS_TOKEN',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  true
);

-- Threads (使用 Instagram Account ID)
INSERT INTO meta_credentials (
  platform,
  access_token,
  instagram_account_id,
  is_active
) VALUES (
  'threads',
  'YOUR_LONG_LIVED_ACCESS_TOKEN',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID',
  true
);
```

## 使用流程

### 1. 為文章創建社群貼文

API: `POST /api/admin/social-posts`

```bash
curl -X POST https://wantcar.autos/api/admin/social-posts \
  -H "Cookie: admin_token=YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "uuid-of-article",
    "platforms": ["facebook", "instagram", "threads"]
  }'
```

**流程**：
1. AI 自動生成 100-200 字摘要
2. 每個平台創建一筆 `pending` 狀態的 `social_posts`
3. 加入管理員審核隊列

### 2. 查看待審核貼文

API: `GET /api/admin/social-posts`

```bash
curl https://wantcar.autos/api/admin/social-posts \
  -H "Cookie: admin_token=YOUR_ADMIN_TOKEN"
```

### 3. 批准並發布貼文

API: `POST /api/admin/social-posts/publish`

```bash
curl -X POST https://wantcar.autos/api/admin/social-posts/publish \
  -H "Cookie: admin_token=YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "uuid-of-social-post"
  }'
```

**流程**：
1. 驗證貼文內容格式
2. 呼叫對應平台 API 發文
3. 更新狀態為 `posted` 或 `failed`
4. 記錄 `post_url` 和 `error_message`

## 平台限制

| 平台       | 字數限制 | 圖片要求       | 連結處理      |
|-----------|---------|--------------|-------------|
| Facebook  | 63,206  | 選填          | Link Preview |
| Instagram | 2,200   | **必須**      | Image URL    |
| Threads   | 500     | 選填          | Link Attach  |

## 故障排除

### 問題：Instagram 發文失敗 "Image required"

**原因**：Instagram Content Publishing API 要求必須有圖片。

**解決方案**：
1. 確保文章頁面有 `<meta property="og:image">` tag
2. 圖片 URL 必須可公開訪問
3. 圖片格式：JPG 或 PNG
4. 最小尺寸：1080x1080px

### 問題：Access Token 過期

**原因**：Long-Lived Token 有效期 60 天。

**解決方案**：
1. 重新獲取 Long-Lived Token
2. 更新 `meta_credentials` 表
3. 設置 cron job 自動更新（進階）

### 問題：Threads 發文失敗 "Invalid user"

**原因**：Threads API 需要 Instagram Business Account。

**解決方案**：
1. 確認 Instagram 帳號已轉為 Business Account
2. 確認已綁定 Facebook Page
3. 使用正確的 Instagram Account ID

## 檔案結構

```
src/
├── lib/
│   └── social/
│       ├── meta-client.ts          # Facebook + Instagram API
│       ├── threads-client.ts       # Threads API
│       └── content-generator.ts    # AI 摘要生成
├── app/
│   └── api/
│       └── admin/
│           └── social-posts/
│               ├── route.ts        # GET: 列表, POST: 創建
│               └── publish/
│                   └── route.ts    # POST: 發布
supabase/
└── migrations/
    └── 20251123_add_social_posts.sql  # DB Schema
```

## 程式碼位置參考

- **Meta API 整合**：`src/lib/social/meta-client.ts:42-77` (Facebook), `:103-166` (Instagram)
- **Threads API 整合**：`src/lib/social/threads-client.ts:48-125`
- **內容生成**：`src/lib/social/content-generator.ts:20-80`
- **發布 API**：`src/app/api/admin/social-posts/publish/route.ts:66-124`
- **資料庫 Schema**：`supabase/migrations/20251123_add_social_posts.sql:1-85`

## 下一步優化（未實作）

1. **自動重試**：失敗貼文自動重試 3 次
2. **定時發文**：設定預定發文時間
3. **圖片上傳**：支援文章封面圖自動上傳
4. **Analytics**：追蹤貼文互動數據
5. **Token 自動更新**：使用 refresh token 自動更新 access token

## 注意事項

- **Rate Limits**：Meta API 有 rate limit，避免短時間大量發文
- **Review Process**：App 需要通過 Meta 審核才能對外使用
- **Privacy Policy**：必須提供 Privacy Policy 和 Terms of Service URL
- **Content Policy**：遵守 Meta 的內容政策，避免帳號被封鎖
