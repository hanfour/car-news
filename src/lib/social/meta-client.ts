/**
 * Meta Graph API Client
 * 用於 Facebook Page 和 Instagram Business Account 發文
 *
 * API 文件：https://developers.facebook.com/docs/graph-api
 */

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/**
 * Meta 平台類型
 */
export type MetaPlatform = 'facebook' | 'instagram'

/**
 * 發文參數
 */
export interface PostParams {
  message: string // 貼文內容
  link: string // 文章連結
}

/**
 * 發文結果
 */
export interface PostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Meta Credentials
 */
export interface MetaCredentials {
  accessToken: string
  pageId?: string // Facebook Page ID
  instagramAccountId?: string // Instagram Business Account ID
}

/**
 * Facebook Page 發文
 *
 * API: POST /{page-id}/feed
 * 文件：https://developers.facebook.com/docs/pages-api/posts
 */
export async function postToFacebookPage(
  credentials: MetaCredentials,
  params: PostParams
): Promise<PostResult> {
  const { accessToken, pageId } = credentials

  if (!pageId) {
    return {
      success: false,
      error: 'Missing Facebook Page ID'
    }
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: params.message,
          link: params.link,
          access_token: accessToken
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('[Facebook] Post failed:', data)
      return {
        success: false,
        error: data.error?.message || 'Unknown error'
      }
    }

    // Post ID 格式: {page-id}_{post-id}
    const postId = data.id
    const postUrl = `https://www.facebook.com/${postId.replace('_', '/posts/')}`

    return {
      success: true,
      postId,
      postUrl
    }
  } catch (error) {
    console.error('[Facebook] Post error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Instagram Business Account 發文
 *
 * Instagram 發文是兩步驟流程：
 * 1. 創建 Media Container (POST /{ig-user-id}/media)
 * 2. 發布 Container (POST /{ig-user-id}/media_publish)
 *
 * 文件：https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * 注意：Instagram 發文必須包含圖片或影片，純文字連結會失敗
 * 我們使用 link sticker 功能來附加連結
 */
export async function postToInstagram(
  credentials: MetaCredentials,
  params: PostParams
): Promise<PostResult> {
  const { accessToken, instagramAccountId } = credentials

  if (!instagramAccountId) {
    return {
      success: false,
      error: 'Missing Instagram Account ID'
    }
  }

  try {
    // Step 1: 創建 Media Container
    // 注意：Instagram 需要圖片，這裡我們使用 Open Graph image from link
    const containerResponse = await fetch(
      `${GRAPH_API_BASE_URL}/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          caption: params.message,
          // 使用文章的 Open Graph image（需要文章頁面有 og:image meta tag）
          image_url: params.link,
          access_token: accessToken
        })
      }
    )

    const containerData = await containerResponse.json()

    if (!containerResponse.ok) {
      console.error('[Instagram] Container creation failed:', containerData)
      return {
        success: false,
        error: containerData.error?.message || 'Failed to create media container'
      }
    }

    const containerId = containerData.id

    // Step 2: 發布 Container
    const publishResponse = await fetch(
      `${GRAPH_API_BASE_URL}/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken
        })
      }
    )

    const publishData = await publishResponse.json()

    if (!publishResponse.ok) {
      console.error('[Instagram] Publish failed:', publishData)
      return {
        success: false,
        error: publishData.error?.message || 'Failed to publish media'
      }
    }

    const postId = publishData.id
    const postUrl = `https://www.instagram.com/p/${postId}/`

    return {
      success: true,
      postId,
      postUrl
    }
  } catch (error) {
    console.error('[Instagram] Post error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 驗證 Access Token 有效性
 */
export async function validateAccessToken(
  accessToken: string
): Promise<{ valid: boolean; expiresAt?: Date; error?: string }> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/me?fields=id,name&access_token=${accessToken}`
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        valid: false,
        error: data.error?.message || 'Invalid access token'
      }
    }

    // 檢查 token 過期時間
    const debugResponse = await fetch(
      `${GRAPH_API_BASE_URL}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    )

    const debugData = await debugResponse.json()

    if (debugData.data?.expires_at) {
      const expiresAt = new Date(debugData.data.expires_at * 1000)
      return {
        valid: true,
        expiresAt
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 獲取 Facebook Page 資訊
 */
export async function getPageInfo(
  accessToken: string,
  pageId: string
): Promise<{ name?: string; error?: string }> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/${pageId}?fields=id,name&access_token=${accessToken}`
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        error: data.error?.message || 'Failed to get page info'
      }
    }

    return { name: data.name }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 獲取 Instagram Business Account 資訊
 */
export async function getInstagramAccountInfo(
  accessToken: string,
  instagramAccountId: string
): Promise<{ username?: string; error?: string }> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/${instagramAccountId}?fields=id,username&access_token=${accessToken}`
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        error: data.error?.message || 'Failed to get Instagram account info'
      }
    }

    return { username: data.username }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
