import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { createServiceClient } from '../src/lib/supabase'
import { downloadAndStoreImage } from '../src/lib/storage/image-downloader'

async function fixExternalImages() {
  const supabase = createServiceClient()

  console.log('🔍 Finding articles with external image URLs...\n')

  const { data: articles, error } = await supabase
    .from('generated_articles')
    .select('id, title_zh, cover_image, image_credit')
    .eq('published', true)
    .not('cover_image', 'is', null)

  if (error) {
    console.error('Error:', error)
    return
  }

  let fixed = 0

  for (const article of articles || []) {
    const url = article.cover_image as string

    // Skip if already using Supabase Storage
    if (url.includes('supabase.co')) {
      continue
    }

    console.log(`\n📥 Downloading external image for: "${article.title_zh}"`)
    console.log(`   Current URL: ${url}`)

    try {
      // Download and store the image
      const storedImage = await downloadAndStoreImage(
        url,
        article.id,
        article.image_credit || 'Unknown'
      )

      if (storedImage) {
        // Update the article with the new Supabase URL
        const { error: updateError } = await supabase
          .from('generated_articles')
          .update({
            cover_image: storedImage.url,
            image_credit: storedImage.credit
          })
          .eq('id', article.id)

        if (updateError) {
          console.error(`   ❌ Failed to update article:`, updateError)
        } else {
          console.log(`   ✅ Updated to: ${storedImage.url}`)
          fixed++
        }
      } else {
        console.log(`   ⚠️  Failed to download image`)
      }
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message)
    }
  }

  console.log(`\n✨ Fixed ${fixed} external images`)
}

fixExternalImages()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
