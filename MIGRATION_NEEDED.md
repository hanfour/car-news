# ⚠️ DATABASE MIGRATION REQUIRED

Before using the Admin API, you MUST run this SQL in your Supabase Dashboard.

## Quick Steps

1. Go to: https://supabase.com/dashboard/project/daubcanyykdfyptntfco
2. Click: **SQL Editor** (left sidebar)
3. Click: **New Query**
4. Copy/paste the SQL below
5. Click: **Run** (or press Cmd+Enter)

## SQL Migration

```sql
-- 添加人工評分欄位到 generated_articles
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);

-- 添加索引以便快速查詢高分文章
CREATE INDEX IF NOT EXISTS idx_generated_articles_human_rating
ON generated_articles(human_rating)
WHERE human_rating IS NOT NULL;

-- 添加註釋
COMMENT ON COLUMN generated_articles.human_rating IS '人工評分 (1-5): 1=極差, 2=差, 3=普通, 4=良好, 5=優秀';
```

## Verify It Worked

After running the SQL, test with:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer Cjz5hMqUj0PeTyVP8jammO0lPRYMMUfB+5UBs8C7qv4=" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/xjBZdZD" \
  | python3 -m json.tool
```

✅ **Success**: You see article data with `"human_rating": 5`
❌ **Failed**: You see error about column not found

## Next Steps

After migration succeeds, read:
- `/docs/ADMIN_API_SUMMARY.md` - Overview and quick start
- `/docs/admin-api-usage.md` - Complete API documentation
- `/docs/DEPLOYMENT.md` - Production deployment guide

---

**Delete this file after completing the migration.**
