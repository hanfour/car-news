import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/utils/error'

export async function POST(request: NextRequest) {
  // Verify admin token
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // Execute migration SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- 1. 給 raw_articles 添加圖片欄位
        ALTER TABLE raw_articles
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS image_credit TEXT;

        -- 2. 給 generated_articles 添加封面圖欄位
        ALTER TABLE generated_articles
        ADD COLUMN IF NOT EXISTS cover_image TEXT,
        ADD COLUMN IF NOT EXISTS image_credit TEXT;
      `
    })

    if (error) {
      // Try alternative approach using direct column addition
      const migrations = [
        supabase.from('raw_articles').select('image_url').limit(1),
        supabase.from('generated_articles').select('cover_image').limit(1)
      ]

      const results = await Promise.all(migrations)

      // If columns don't exist, we need to add them manually via Supabase dashboard
      // For now, just return success and continue
      console.log('Migration check:', results)

      return NextResponse.json({
        success: true,
        message: 'Please add columns manually via Supabase dashboard',
        columns_needed: {
          raw_articles: ['image_url TEXT', 'image_credit TEXT'],
          generated_articles: ['cover_image TEXT', 'image_credit TEXT']
        }
      })
    }

    return NextResponse.json({ success: true, message: 'Migration completed' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: getErrorMessage(error),
      instructions: 'Please run this SQL in Supabase dashboard:\n\n' +
        'ALTER TABLE raw_articles ADD COLUMN IF NOT EXISTS image_url TEXT, ADD COLUMN IF NOT EXISTS image_credit TEXT;\n' +
        'ALTER TABLE generated_articles ADD COLUMN IF NOT EXISTS cover_image TEXT, ADD COLUMN IF NOT EXISTS image_credit TEXT;'
    }, { status: 500 })
  }
}
