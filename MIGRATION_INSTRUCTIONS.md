# Database Migration Instructions

## ⚠️ URGENT: Comment Likes Migration Required

The comment like and reply features have been deployed, but the database migration must be applied manually.

## Error You're Seeing

```
POST /api/comments/[id]/like 500 (Internal Server Error)
new row violates row-level security policy for table "comment_likes"
```

This is because the `comment_likes` table doesn't exist yet in your production database.

## How to Fix (2 Minutes)

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard
   - Navigate to your project
   - Click on "SQL Editor" in the left sidebar

2. **Copy the SQL**
   ```bash
   cat supabase/migrations/20251118_add_comment_likes.sql
   ```

3. **Paste and Execute**
   - Create a new query in SQL Editor
   - Paste the entire SQL content
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Run this test query:
   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'comment_likes';
   ```
   - Should return: `comment_id`, `user_id`, `created_at`

### Option 2: Using psql (If you have database connection string)

```bash
# Get your database connection string from Supabase Dashboard > Project Settings > Database
psql "YOUR_DATABASE_CONNECTION_STRING" < supabase/migrations/20251118_add_comment_likes.sql
```

## What This Migration Does

1. **Creates `comment_likes` table**
   - Stores user likes on comments
   - Prevents duplicate likes with composite primary key

2. **Adds `likes_count` column to `comments` table**
   - Cached count for performance
   - Auto-updated by database triggers

3. **Sets up Row-Level Security (RLS)**
   - Everyone can view likes
   - Only authenticated users can like
   - Users can only unlike their own likes

4. **Creates automatic trigger**
   - Updates `likes_count` when likes are added/removed

## After Migration

Test the features:
1. ✅ Click the like button on a comment → count increases
2. ✅ Click again → count decreases (unlike)
3. ✅ Open in incognito window → see same like count
4. ✅ Click "Reply" → shows reply form
5. ✅ Submit a reply → appears under the comment

## Troubleshooting

### If you see "permission denied" errors
Run this in SQL Editor:
```sql
GRANT ALL ON TABLE public.comment_likes TO postgres, service_role;
GRANT SELECT ON TABLE public.comment_likes TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.comment_likes TO authenticated;
```

### If the migration was partially applied
Check what exists:
```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'comment_likes'
);

-- Check if column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'comments'
AND column_name = 'likes_count';
```

## Complete Migration SQL

The full SQL is in: `supabase/migrations/20251118_add_comment_likes.sql`

Or view it here:
