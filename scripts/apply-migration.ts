import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function applyMigration() {
  console.log('Applying human_rating migration...')

  // Step 1: Add column
  const { error: addColumnError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE generated_articles
      ADD COLUMN IF NOT EXISTS human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);
    `
  })

  if (addColumnError) {
    console.error('Error adding column:', addColumnError)
    // Try direct query instead
    const { error: directError } = await supabase
      .from('generated_articles')
      .select('human_rating')
      .limit(1)

    if (directError && directError.message.includes('column "human_rating" does not exist')) {
      console.error('Column does not exist and cannot be created via API.')
      console.log('\n⚠️  Please manually execute this SQL in Supabase Dashboard > SQL Editor:')
      console.log('\n' + `
-- 添加人工評分欄位到 generated_articles
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5);

-- 添加索引以便快速查詢高分文章
CREATE INDEX IF NOT EXISTS idx_generated_articles_human_rating
ON generated_articles(human_rating)
WHERE human_rating IS NOT NULL;

-- 添加註釋
COMMENT ON COLUMN generated_articles.human_rating IS '人工評分 (1-5): 1=極差, 2=差, 3=普通, 4=良好, 5=優秀';
      `.trim() + '\n')
      console.log('\n✅ After running the SQL, the Admin API will work correctly.')
      return
    }
  }

  console.log('✅ Migration applied successfully!')
}

applyMigration()
