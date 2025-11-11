/**
 * Create get_popular_tags function in Supabase
 * Run with: node --env-file=.env.local scripts/create-tags-function.js
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const sql = `
-- Create function to get popular tags efficiently using database aggregation
CREATE OR REPLACE FUNCTION get_popular_tags(tag_limit INT DEFAULT 30)
RETURNS TABLE (name TEXT, count BIGINT) AS $$
  SELECT
    tag as name,
    COUNT(*) as count
  FROM
    generated_articles,
    unnest(tags) as tag
  WHERE
    published = true
    AND tags IS NOT NULL
  GROUP BY tag
  ORDER BY count DESC
  LIMIT tag_limit;
$$ LANGUAGE SQL STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_popular_tags IS 'Returns the most popular tags from published articles, sorted by frequency';
`

console.log('Creating get_popular_tags function...\n')

try {
  // Test if function already exists by trying to call it
  const { data: testData, error: testError } = await supabase.rpc('get_popular_tags', { tag_limit: 1 })

  if (!testError) {
    console.log('✅ Function get_popular_tags already exists!')
    console.log('Test query returned:', testData)
    process.exit(0)
  }

  console.log('Function does not exist yet. Please create it manually in Supabase Dashboard:')
  console.log('\n1. Go to: https://supabase.com/dashboard/project/daubcanyykdfyptntfco/sql/new')
  console.log('\n2. Paste this SQL:\n')
  console.log('---')
  console.log(sql)
  console.log('---')
  console.log('\n3. Click "Run"\n')

} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}
