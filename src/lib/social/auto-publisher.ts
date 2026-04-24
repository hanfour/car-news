/**
 * Social Media Auto Publisher
 * 自動為文章建立社群貼文，並可選擇自動發布
 */

import { createServiceClient } from '@/lib/supabase'
import { generateMultiPlatformContent, formatPostContent, validatePostContent } from '@/lib/social/content-generator'
import { postToFacebookPage } from '@/lib/social/meta-client'
import { postToInstagram } from '@/lib/social/meta-client'
import { postToThreads } from '@/lib/social/threads-client'
import { logger } from '@/lib/logger'

interface ArticleInput {
  id: string
  title_zh: string
  content_zh: string
  slug_en: string
  cover_image?: string | null
}

/**
 * 為文章建立社群貼文
 * 若 SOCIAL_AUTO_PUBLISH=true，會自動發布
 */
export async function createSocialPostsForArticle(article: ArticleInput): Promise<{
  created: number
  published: number
  errors: string[]
}> {
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.autos'
  const articleUrl = `${baseUrl}/${article.slug_en}`
  const autoPublish = process.env.SOCIAL_AUTO_PUBLISH === 'true'

  const result = { created: 0, published: 0, errors: [] as string[] }

  const platforms: ('facebook' | 'instagram' | 'threads')[] = article.cover_image
    ? ['facebook', 'instagram', 'threads']
    : ['facebook', 'threads'] // 無封面圖跳過 Instagram

  // 檢查是否已有貼文（防重複）
  const { data: existing } = await supabase
    .from('social_posts')
    .select('platform')
    .eq('article_id', article.id)

  const existingPlatforms = new Set(existing?.map(p => p.platform) || [])
  const newPlatforms = platforms.filter(p => !existingPlatforms.has(p))

  if (newPlatforms.length === 0) {
    logger.info('social.auto_publish.skip_existing', { articleId: article.id })
    return result
  }

  // 生成多平台內容
  let content: { facebook: string; instagram: string; threads: string }
  try {
    content = await generateMultiPlatformContent(
      article.title_zh,
      article.content_zh,
      articleUrl
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Content generation failed: ${msg}`)
    return result
  }

  // 為每個平台建立貼文
  for (const platform of newPlatforms) {
    try {
      const { data: post, error: insertError } = await supabase
        .from('social_posts')
        .insert({
          article_id: article.id,
          platform,
          content: content[platform],
          article_url: articleUrl,
          status: 'pending'
        })
        .select('id')
        .single()

      if (insertError) {
        result.errors.push(`[${platform}] Insert failed: ${insertError.message}`)
        continue
      }

      result.created++
      logger.info('social.auto_publish.post_created', { articleId: article.id, platform })

      // 自動發布
      if (autoPublish && post) {
        const publishResult = await publishSocialPost(post.id)
        if (publishResult.success) {
          result.published++
        } else {
          result.errors.push(`[${platform}] Publish failed: ${publishResult.error}`)
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`[${platform}] ${msg}`)
    }
  }

  return result
}

/**
 * 發布單一社群貼文
 * 從 publish/route.ts 抽取的核心邏輯
 */
export async function publishSocialPost(postId: string): Promise<{
  success: boolean
  postUrl?: string
  error?: string
}> {
  const supabase = createServiceClient()

  // 取得貼文 + 文章封面圖
  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select(`
      *,
      article:generated_articles(cover_image)
    `)
    .eq('id', postId)
    .single()

  if (postError || !post) {
    return { success: false, error: 'Post not found' }
  }

  if (post.status === 'posted') {
    return { success: false, error: 'Post already published' }
  }

  // 格式化貼文內容
  const content = formatPostContent(
    post.content,
    post.article_url,
    post.platform
  )

  // 驗證內容
  const validation = validatePostContent(content, post.platform)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // 取得平台認證
  const { data: credentials, error: credError } = await supabase
    .from('meta_credentials')
    .select('*')
    .eq('platform', post.platform)
    .eq('is_active', true)
    .single()

  if (credError || !credentials) {
    return { success: false, error: `No active credentials for ${post.platform}` }
  }

  // 根據平台發文
  try {
    let result

    if (post.platform === 'facebook') {
      result = await postToFacebookPage(
        {
          accessToken: credentials.access_token,
          pageId: credentials.page_id
        },
        {
          message: content,
          link: post.article_url
        }
      )
    } else if (post.platform === 'instagram') {
      const coverImage = post.article?.cover_image
      if (!coverImage) {
        await supabase
          .from('social_posts')
          .update({
            status: 'failed',
            error_message: 'No cover image available for Instagram',
            reviewed_at: new Date().toISOString()
          })
          .eq('id', postId)
        return { success: false, error: 'No cover image available for Instagram' }
      }

      result = await postToInstagram(
        {
          accessToken: credentials.access_token,
          instagramAccountId: credentials.instagram_account_id
        },
        {
          message: content,
          link: post.article_url,
          imageUrl: coverImage
        }
      )
    } else if (post.platform === 'threads') {
      result = await postToThreads(
        {
          accessToken: credentials.access_token,
          threadsUserId: credentials.threads_user_id || credentials.instagram_account_id
        },
        {
          text: content,
          link: post.article_url
        }
      )
    } else {
      return { success: false, error: 'Unsupported platform' }
    }

    // 更新狀態
    if (result.success) {
      await supabase
        .from('social_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          post_url: result.postUrl,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', postId)

      return { success: true, postUrl: result.postUrl }
    } else {
      await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          error_message: result.error,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', postId)

      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('social.publish_fail', error, { postId })

    await supabase
      .from('social_posts')
      .update({
        status: 'failed',
        error_message: errorMsg,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', postId)

    return { success: false, error: errorMsg }
  }
}
