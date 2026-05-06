# Admin API MVP - Implementation Complete! 🎉

## What's Been Built

I've implemented a complete Admin API MVP system that allows you to manage articles and track quality for future AI improvements.

### Features Implemented

✅ **List Articles** - Filter by published status, brand, with pagination
✅ **Update Articles** - Modify title, content, categories, tags, etc.
✅ **Publish/Unpublish** - Control article visibility
✅ **Quality Rating** - Rate articles 1-5 for future AI training
✅ **Delete Articles** - Remove low-quality content
✅ **Authentication** - Secure Bearer token authentication

### Files Created

```
src/app/api/admin/articles/route.ts          # GET endpoint (list articles)
src/app/api/admin/articles/[id]/route.ts     # PATCH/DELETE endpoints
supabase/migrations/20251112_add_human_rating.sql  # Database schema
docs/admin-api-usage.md                       # Complete API documentation
docs/DEPLOYMENT.md                            # Deployment instructions
docs/ADMIN_API_SUMMARY.md                     # This file
scripts/test-admin-api.sh                     # Test suite
scripts/apply-migration.ts                    # Migration helper
```

## ⚠️ Next Steps Required

### 1. Apply Database Migration (5 minutes)

The `human_rating` column needs to be added to your database:

**Go to Supabase Dashboard:**

- URL: https://supabase.com/dashboard/project/daubcanyykdfyptntfco
- Click "SQL Editor" → "New Query"
- Copy/paste SQL from `supabase/migrations/20251112_add_human_rating.sql`
- Click "Run"

**Quick verification:**

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/xjBZdZD" \
  | python3 -m json.tool
```

If you see article data with `"human_rating": 5`, migration is successful! ✅

### 2. Test the API (10 minutes)

Try these commands to familiarize yourself with the API:

```bash
# List top articles
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=5" \
  | python3 -m json.tool

# Find low-confidence articles (need review)
curl -s -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "http://localhost:3000/api/admin/articles?published=true&limit=100" \
  | python3 -m json.tool \
  | grep -B2 -A2 '"confidence": [0-6][0-9]'

# Rate an article as excellent
curl -s -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"human_rating": 5}' \
  "http://localhost:3000/api/admin/articles/ARTICLE_ID"
```

### 3. Deploy to Production (Optional - 15 minutes)

See `docs/DEPLOYMENT.md` for full instructions. Summary:

1. Add `ADMIN_API_KEY` to Vercel environment variables
2. Repeat database migration in production Supabase
3. Git push to deploy
4. Test with production URL

## How This Helps AI Training

### Phase 1: Data Collection (Current)

Use the `human_rating` field to mark articles:

- **5 (優秀)**: Perfect examples for future AI training
- **4 (良好)**: Good quality, minor issues
- **3 (普通)**: Acceptable but could improve
- **2 (差)**: Below standard, needs review
- **1 (極差)**: Bad quality, unpublish or delete

### Phase 2: Future Improvements

Once you have 20-50 rated articles:

1. **Few-Shot Learning** - Use highly-rated articles as examples in AI prompts
2. **Prompt Tuning** - Analyze what makes good articles good, adjust prompts
3. **Quality Filtering** - Auto-unpublish articles below certain thresholds
4. **A/B Testing** - Compare different AI models/prompts using ratings

## API Documentation

Full documentation: `/docs/admin-api-usage.md`

### Quick Reference

**List articles:**

```
GET /api/admin/articles?published=true&brand=Tesla&limit=50&offset=0
```

**Update article:**

```
PATCH /api/admin/articles/{id}
Body: {"published": false, "human_rating": 2}
```

**Delete article:**

```
DELETE /api/admin/articles/{id}
```

**Authentication:**
All requests require: `Authorization: Bearer YOUR_API_KEY`

## Security Notes

- ✅ API key stored in `.env.local` (not committed to git)
- ✅ 32-byte random key used (strong entropy)
- ⚠️ Generate a NEW key for production deployment
- ⚠️ Only use API from trusted environments
- ⚠️ Consider IP whitelisting for production (future enhancement)

## What's NOT Included (Out of Scope for MVP)

- ❌ Web UI Dashboard - Use curl/API for now
- ❌ Multi-user authentication - Single API key only
- ❌ Rate limiting - Trust yourself not to spam
- ❌ Audit logs - No history of who changed what
- ❌ Batch operations UI - Use shell scripts (examples in docs)

If you find yourself using the API frequently and want a web UI, see `/docs/admin-dashboard-plan.md` for the full dashboard implementation plan.

## Example Workflow: Weekly Quality Review

```bash
#!/bin/bash
# Save as scripts/weekly-review.sh

API_KEY="YOUR_ADMIN_API_KEY"
BASE_URL="http://localhost:3000"

echo "📊 This Week's Articles"
echo "======================="

# Get this week's articles
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=100" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data['articles'][:20]:  # First 20
    print(f\"ID: {a['id']:10} | {a['title_zh'][:50]:50} | Conf: {a['confidence']:2} | Views: {a['view_count']:4}\")
"

echo ""
echo "🔍 Low Confidence (<70) - Needs Review:"
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/admin/articles?published=true&limit=100" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data['articles']:
    if a['confidence'] < 70:
        print(f\"❌ ID: {a['id']:10} | {a['title_zh'][:60]:60} | Conf: {a['confidence']:2}\")
"

echo ""
echo "📝 To unpublish an article: curl -X PATCH -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' -d '{\"published\": false, \"human_rating\": 2}' '$BASE_URL/api/admin/articles/ARTICLE_ID'"
```

## Support

- API Issues: Check `/docs/DEPLOYMENT.md` Troubleshooting section
- Usage Examples: See `/docs/admin-api-usage.md`
- Test Suite: Run `./scripts/test-admin-api.sh` (requires jq installation)

---

**Status**: ✅ Implementation Complete - Database migration required before use
