# Deployment Guide - Admin API MVP

## ⚠️ REQUIRED: Database Migration

The Admin API requires a new `human_rating` column in the database. This migration **MUST** be applied before using the Admin API.

### Step 1: Apply Database Migration

Go to your Supabase Dashboard:
1. Navigate to https://supabase.com/dashboard/project/daubcanyykdfyptntfco
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the following SQL:

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

5. Click "Run" or press `Cmd+Enter`
6. You should see "Success. No rows returned"

### Step 2: Verify Migration

Test that the migration worked:

```bash
curl -H "Authorization: Bearer Cjz5hMqUj0PeTyVP8jammO0lPRYMMUfB+5UBs8C7qv4=" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/xjBZdZD"
```

You should see the article data with `"human_rating": 5` instead of an error.

## Production Deployment (Vercel)

### Step 3: Add Environment Variables

In your Vercel project settings, add:

```
ADMIN_API_KEY=Cjz5hMqUj0PeTyVP8jammO0lPRYMMUfB+5UBs8C7qv4=
```

**IMPORTANT**: Use a different, even stronger API key for production!

Generate a new one with:
```bash
openssl rand -base64 32
```

### Step 4: Deploy

```bash
git add .
git commit -m "Add Admin API MVP"
git push origin main
```

Vercel will automatically deploy.

### Step 5: Apply Production Migration

Repeat Step 1 but make sure you're logged into the production Supabase instance (same one, but double-check the project ID).

## Using the Admin API

See `/docs/admin-api-usage.md` for complete documentation on how to use the API.

### Quick Test (Production)

```bash
# Replace with your production URL
curl -H "Authorization: Bearer YOUR_PRODUCTION_API_KEY" \
  "https://wantcar.com/api/admin/articles?published=true&limit=5"
```

## Security Checklist

- [ ] Migration applied in Supabase Dashboard
- [ ] Strong API key generated for production
- [ ] API key added to Vercel environment variables
- [ ] `.env.local` is in `.gitignore` (never commit secrets!)
- [ ] Test scripts updated with production URL for production testing

## Troubleshooting

### Error: "Could not find the 'human_rating' column"

**Solution**: The database migration hasn't been applied. Go back to Step 1.

### Error: "Unauthorized" (401)

**Solution**: Check that:
1. You're using the correct API key
2. The header format is exactly: `Authorization: Bearer YOUR_API_KEY`
3. The `ADMIN_API_KEY` environment variable is set in Vercel

### Error: "Cannot find project ref"

**Solution**: This is expected when using `supabase db push` without local Supabase CLI setup. Use the Supabase Dashboard SQL Editor instead (Step 1).
