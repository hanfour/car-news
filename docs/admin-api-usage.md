# Admin API 使用指南 (MVP)

## 設定

### 1. 設定 Admin API Key

在 `.env.local` 添加:

```bash
ADMIN_API_KEY=your-super-secret-admin-key-here
```

**重要**: 請使用強密碼!建議用以下命令生成:
```bash
openssl rand -base64 32
```

### 2. 執行數據庫遷移

```bash
# 如果使用 Supabase CLI
supabase db push

# 或者直接在 Supabase Dashboard > SQL Editor 執行:
cat supabase/migrations/20251112_add_human_rating.sql
```

## API 端點

### 1. 列出文章

```bash
# 列出所有已發布文章
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true"

# 列出所有草稿
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=false"

# 篩選特定品牌
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?brand=Tesla"

# 分頁
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?limit=10&offset=0"
```

**響應範例**:
```json
{
  "articles": [
    {
      "id": "abc123",
      "title_zh": "特斯拉 Model 3 降價",
      "published": true,
      "published_at": "2025-11-12",
      "confidence": 85,
      "primary_brand": "Tesla",
      "categories": ["新車", "電動車"],
      "view_count": 1234
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### 2. 下架文章

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

### 3. 重新發布文章

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": true}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

### 4. 給文章評分 (1-5)

```bash
# 標記為優秀文章
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"

# 標記為差文章
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 2}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

### 5. 編輯文章內容

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title_zh": "修正後的標題",
    "categories": ["新車"],
    "tags": ["電動車", "Tesla"]
  }' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

### 6. 刪除文章

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

## 常見使用場景

### 場景 1: 找出所有低質量文章

```bash
# 1. 列出所有已發布文章
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=100" \
  | jq '.articles[] | select(.confidence < 70) | {id, title_zh, confidence}'

# 2. 手動審查後下架
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false, "human_rating": 2}' \
  "http://localhost:3000/api/admin/articles/BAD_ARTICLE_ID"
```

### 場景 2: 標記優質文章 (用於未來的 Few-Shot Learning)

```bash
# 1. 找到高 confidence 文章
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true" \
  | jq '.articles[] | select(.confidence >= 90) | {id, title_zh, confidence}'

# 2. 人工審查後標記為優質
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/GOOD_ARTICLE_ID"
```

### 場景 3: 批量操作 (使用 jq + xargs)

```bash
# 下架所有 confidence < 60 的文章
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=1000" \
  | jq -r '.articles[] | select(.confidence < 60) | .id' \
  | xargs -I {} curl -X PATCH \
      -H "Authorization: Bearer $ADMIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"published": false}' \
      "http://localhost:3000/api/admin/articles/{}"
```

## 安全提醒

1. **絕不要** 把 `ADMIN_API_KEY` 提交到 Git
2. 在生產環境使用強密碼 (至少 32 字符)
3. 只在受信任的環境中使用這些 API
4. 考慮添加 IP 白名單限制 (未來版本)

## 升級到完整 Dashboard

如果你發現經常使用這些 API,可以考慮實現完整的 Web Dashboard:
- 參考 `/docs/admin-dashboard-plan.md`
- 預計開發時間: 2-3 天
- 功能: 圖表、搜尋、批量操作、Prompt 編輯器等
