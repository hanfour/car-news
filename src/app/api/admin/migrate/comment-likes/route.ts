import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error'

export async function POST(request: NextRequest) {
  try {
    // Security: Check authorization
    const authHeader = request.headers.get('Authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Check if already applied
    const { error: checkError } = await supabase
      .from('comments')
      .select('likes_count')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        message: 'Migration already applied - likes_count column exists'
      })
    }

    console.log('[Migration] Starting comment_likes migration...')

    // Execute migration SQL statements one by one
    const migrations = [
      // 1. Create comment_likes table
      `
        CREATE TABLE IF NOT EXISTS public.comment_likes (
          comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (comment_id, user_id)
        );
      `,
      // 2. Add indexes
      `CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON public.comment_likes(comment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_comment_likes_created ON public.comment_likes(created_at DESC);`,
      // 3. Add likes_count column
      `ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;`,
      // 4. Create trigger function
      `
        CREATE OR REPLACE FUNCTION update_comment_likes_count()
        RETURNS TRIGGER AS $$
        BEGIN
          IF TG_OP = 'INSERT' THEN
            UPDATE public.comments
            SET likes_count = likes_count + 1
            WHERE id = NEW.comment_id;
          ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.comments
            SET likes_count = GREATEST(0, likes_count - 1)
            WHERE id = OLD.comment_id;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
      `,
      // 5. Create trigger
      `DROP TRIGGER IF EXISTS trigger_update_comment_likes_count ON public.comment_likes;`,
      `
        CREATE TRIGGER trigger_update_comment_likes_count
          AFTER INSERT OR DELETE ON public.comment_likes
          FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();
      `,
      // 6. Enable RLS
      `ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;`,
      // 7. Create RLS policies
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'comment_likes' AND policyname = 'Comment likes are viewable by everyone'
          ) THEN
            CREATE POLICY "Comment likes are viewable by everyone"
              ON public.comment_likes FOR SELECT
              USING (true);
          END IF;
        END $$;
      `,
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'comment_likes' AND policyname = 'Authenticated users can like comments'
          ) THEN
            CREATE POLICY "Authenticated users can like comments"
              ON public.comment_likes FOR INSERT
              WITH CHECK (auth.uid() = user_id);
          END IF;
        END $$;
      `,
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'comment_likes' AND policyname = 'Users can remove own likes'
          ) THEN
            CREATE POLICY "Users can remove own likes"
              ON public.comment_likes FOR DELETE
              USING (auth.uid() = user_id);
          END IF;
        END $$;
      `
    ]

    const results = []

    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i].trim()
      if (!sql) continue

      console.log(`[Migration ${i + 1}/${migrations.length}] Executing...`)

      try {
        const { error } = await supabase.rpc('exec_sql', { sql })

        if (error) {
          console.error(`[Migration ${i + 1}] Error:`, error)
          results.push({ step: i + 1, error: error.message })
        } else {
          console.log(`[Migration ${i + 1}] Success`)
          results.push({ step: i + 1, success: true })
        }
      } catch (err) {
        console.error(`[Migration ${i + 1}] Exception:`, err)
        results.push({ step: i + 1, error: getErrorMessage(err) })
      }
    }

    const hasErrors = results.some(r => r.error)

    if (hasErrors) {
      console.log('\n⚠️  Some migration steps failed. You may need to run the SQL manually.')
      console.log('SQL file: supabase/migrations/20251118_add_comment_likes.sql')

      return NextResponse.json({
        message: 'Migration partially applied - some steps failed',
        results
      }, { status: 207 })
    }

    console.log('\n✅ Migration applied successfully!')

    return NextResponse.json({
      message: 'Migration applied successfully',
      results
    })
  } catch (error) {
    console.error('[Migration] Unexpected error:', getErrorMessage(error))
    return NextResponse.json(
      { error: 'Migration failed', details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
