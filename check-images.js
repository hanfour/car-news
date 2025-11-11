// Quick script to check if raw_articles have images
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkImages() {
  // Check total articles
  const { count: total } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })

  console.log(`Total raw articles: ${total}`)

  // Check articles with images
  const { count: withImages } = await supabase
    .from('raw_articles')
    .select('*', { count: 'exact', head: true })
    .not('image_url', 'is', null)

  console.log(`Articles with images: ${withImages}`)
  console.log(`Articles without images: ${total - withImages}`)

  // Show sample of recent articles
  const { data: recent } = await supabase
    .from('raw_articles')
    .select('url, title, image_url, image_credit, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('\nRecent 5 articles:')
  recent.forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.title}`)
    console.log(`   Image: ${article.image_url ? 'YES' : 'NO'}`)
    if (article.image_url) {
      console.log(`   Credit: ${article.image_credit}`)
    }
  })
}

checkImages().catch(console.error)
