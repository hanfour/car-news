import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { verifySessionToken } from '@/lib/admin/session'
import { downloadAndStoreImages } from '@/lib/storage/image-downloader'
import { isLegalImageSource } from '@/config/image-sources'

export const maxDuration = 300 // 5 分鐘

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${ADMIN_API_KEY}`) return true

  const sessionCookie = request.cookies.get('admin_session')
  if (sessionCookie?.value) {
    const userId = await verifySessionToken(sessionCookie.value)
    if (!userId) return false
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    return data?.is_admin === true
  }
  return false
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 從 HTML 提取圖片 URL（og:image、twitter:image、article img）
 */
function extractImagesFromHtml(html: string): string[] {
  const images: string[] = []
  const seen = new Set<string>()

  function addImage(url: string) {
    if (!url || seen.has(url)) return
    // 排除 base64、data URL、svg、tracking pixels
    if (url.startsWith('data:') || url.endsWith('.svg') || url.includes('pixel') || url.includes('tracking')) return
    seen.add(url)
    images.push(url)
  }

  // og:image
  const ogMatches = html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)
  for (const m of ogMatches) addImage(m[1])
  const ogMatches2 = html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi)
  for (const m of ogMatches2) addImage(m[1])

  // twitter:image
  const twMatches = html.matchAll(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi)
  for (const m of twMatches) addImage(m[1])
  const twMatches2 = html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi)
  for (const m of twMatches2) addImage(m[1])

  // 文章內 <img> tags（限制前 10 個）
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
  let imgCount = 0
  for (const m of imgMatches) {
    if (imgCount >= 10) break
    addImage(m[1])
    imgCount++
  }

  return images
}

/**
 * Fetch 文章頁面 HTML（前 50KB）
 */
async function fetchArticleHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarNewsAI/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!response.ok || !response.body) return null

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 50 * 1024

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalBytes += value.length
    }
    reader.cancel()

    return new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : Buffer.concat(chunks)
    )
  } catch {
    return null
  }
}

interface BackfillDetail {
  articleId: string
  title: string
  sourceUrls: string[]
  imagesFound: string[]
  legalImages: string[]
  imagesStored: number
  regenerated: boolean
  error?: string
}

// POST /api/admin/images/backfill
export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let articleIds: string[] | undefined
  let brand: string | undefined
  let dryRun = false
  let regenerate = false

  try {
    const body = await request.json()
    if (Array.isArray(body.articleIds)) articleIds = body.articleIds
    if (typeof body.brand === 'string') brand = body.brand
    if (body.dryRun === true) dryRun = true
    if (body.regenerate === true) regenerate = true
  } catch {
    // No body — process all
  }

  const supabase = createServiceClient()

  // 查詢 images 為空且有 source_urls 的已發布文章
  let query = supabase
    .from('generated_articles')
    .select('id, title_zh, source_urls, images, brands')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (articleIds && articleIds.length > 0) {
    query = query.in('id', articleIds)
  }

  const { data: articles, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: 'No articles found', processed: 0 })
  }

  // 篩選：images 為空陣列 + 有 source_urls（除非指定了 articleIds 強制處理）
  let toProcess = articles.filter(a => {
    const hasEmptyImages = !a.images || (Array.isArray(a.images) && a.images.length === 0)
    const hasSourceUrls = a.source_urls && Array.isArray(a.source_urls) && a.source_urls.length > 0
    // 若指定了 articleIds，即使已有 images 也處理（以便強制回溯）
    if (articleIds && articleIds.length > 0) return hasSourceUrls
    return hasEmptyImages && hasSourceUrls
  })

  // 品牌篩選
  if (brand) {
    const brandLower = brand.toLowerCase()
    toProcess = toProcess.filter(a =>
      a.brands && Array.isArray(a.brands) &&
      a.brands.some((b: string) => b.toLowerCase().includes(brandLower))
    )
  }

  if (toProcess.length === 0) {
    return NextResponse.json({
      message: 'No articles need backfill',
      totalChecked: articles.length,
      processed: 0,
    })
  }

  console.log(`→ Image backfill: ${toProcess.length} articles to process (dryRun=${dryRun}, regenerate=${regenerate})`)

  const details: BackfillDetail[] = []
  let totalImagesFound = 0
  let totalImagesStored = 0
  let totalRegenerated = 0

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i]
    const sourceUrls = (article.source_urls as string[]) || []
    const detail: BackfillDetail = {
      articleId: article.id,
      title: article.title_zh || article.id,
      sourceUrls,
      imagesFound: [],
      legalImages: [],
      imagesStored: 0,
      regenerated: false,
    }

    console.log(`  [${i + 1}/${toProcess.length}] ${article.title_zh?.slice(0, 40)}...`)

    try {
      // 對每個 source_url fetch HTML 提取圖片
      const allFoundImages: string[] = []

      for (let j = 0; j < sourceUrls.length; j++) {
        const html = await fetchArticleHtml(sourceUrls[j])
        if (html) {
          const images = extractImagesFromHtml(html)
          allFoundImages.push(...images)
        }

        // 每 3 個 URL 暫停 500ms 避免封鎖
        if ((j + 1) % 3 === 0 && j < sourceUrls.length - 1) {
          await sleep(500)
        }
      }

      // 去重
      const uniqueImages = [...new Set(allFoundImages)]
      detail.imagesFound = uniqueImages
      totalImagesFound += uniqueImages.length

      // 篩選合法來源
      const legalImages = uniqueImages.filter(url => {
        const check = isLegalImageSource(url)
        return check.isLegal
      })
      detail.legalImages = legalImages

      console.log(`    Found ${uniqueImages.length} images, ${legalImages.length} from legal sources`)

      if (dryRun || legalImages.length === 0) {
        details.push(detail)
        continue
      }

      // 下載並存儲合法圖片
      const imagesToStore = legalImages.slice(0, 5).map(url => ({
        url,
        credit: 'media',
      }))

      const storedImages = await downloadAndStoreImages(imagesToStore, article.id)
      detail.imagesStored = storedImages.length
      totalImagesStored += storedImages.length

      if (storedImages.length > 0) {
        // 更新 generated_articles.images
        await supabase
          .from('generated_articles')
          .update({ images: storedImages })
          .eq('id', article.id)

        console.log(`    ✓ Stored ${storedImages.length} images`)

        // 可選：用新圖片重新生成封面
        if (regenerate) {
          try {
            const { generateAndSaveCoverImage } = await import('@/lib/ai/image-generation')
            const referenceImages = storedImages.map(img => ({
              url: img.url,
              caption: img.caption,
              size: 0,
            }))

            const coverResult = await generateAndSaveCoverImage(
              article.title_zh || '',
              '', // content 不可用，img2img 主要依賴參考圖
              article.brands as string[] | undefined,
              referenceImages
            )

            if (coverResult) {
              await supabase
                .from('generated_articles')
                .update({
                  cover_image: coverResult.url,
                  image_credit: coverResult.credit,
                })
                .eq('id', article.id)

              detail.regenerated = true
              totalRegenerated++
              console.log(`    ✓ Regenerated cover image`)
            }
          } catch (err) {
            console.error(`    ✗ Regeneration failed:`, err instanceof Error ? err.message : err)
            detail.error = `Regeneration failed: ${err instanceof Error ? err.message : String(err)}`
          }
        }
      }
    } catch (err) {
      detail.error = err instanceof Error ? err.message : String(err)
      console.error(`    ✗ Failed:`, detail.error)
    }

    details.push(detail)

    // Rate limit between articles
    if (i < toProcess.length - 1) {
      await sleep(300)
    }
  }

  console.log(`✓ Backfill complete: ${toProcess.length} processed, ${totalImagesFound} found, ${totalImagesStored} stored, ${totalRegenerated} regenerated`)

  return NextResponse.json({
    processed: toProcess.length,
    imagesFound: totalImagesFound,
    imagesStored: totalImagesStored,
    regenerated: totalRegenerated,
    dryRun,
    details,
  })
}
