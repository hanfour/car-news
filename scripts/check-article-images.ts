import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkArticleImages() {
  const { data } = await supabase
    .from('generated_articles')
    .select('id, title_zh, images, cover_image')
    .eq('id', 'oJLCfv4')
    .single()

  console.log('文章ID:', data?.id)
  console.log('標題:', data?.title_zh)
  console.log('封面圖:', data?.cover_image)
  console.log('圖片數量:', data?.images?.length || 0)
  console.log('\n圖片列表:')
  data?.images?.forEach((img: any, i: number) => {
    console.log(`${i + 1}. ${img.url}`)
    console.log(`   原始: ${img.originalUrl}`)
  })
}

checkArticleImages()
