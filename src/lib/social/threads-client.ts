/**
 * Threads API Client
 * 用於 Meta Threads 平台發文
 *
 * API 文件：https://developers.facebook.com/docs/threads
 */

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/**
 * 發文參數
 */
export interface ThreadsPostParams {
  text: string // 貼文文字內容（最多 500 字元）
  link?: string // 可選的連結
}

/**
 * 發文結果
 */
export interface ThreadsPostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

/**
 * Threads Credentials
 */
export interface ThreadsCredentials {
  accessToken: string
  threadsUserId: string // Threads User ID
}

/**
 * Threads 發文
 *
 * Threads 發文是兩步驟流程：
 * 1. 創建 Media Container (POST /{threads-user-id}/threads)
 * 2. 發布 Container (POST /{threads-user-id}/threads_publish)
 *
 * 文件：https://developers.facebook.com/docs/threads/posts
 */
export async function postToThreads(
  credentials: ThreadsCredentials,
  params: ThreadsPostParams
): Promise<ThreadsPostResult> {
  const { accessToken, threadsUserId } = credentials

  if (!threadsUserId) {
    return {
      success: false,
      error: 'Missing Threads User ID'
    }
  }

  try {
    // Threads 文字限制 500 字元
    if (params.text.length > 500) {
      return {
        success: false,
        error: `Text too long (${params.text.length}/500 characters)`
      }
    }

    // Step 1: 創建 Media Container
    const containerPayload: Record<string, string> = {
      media_type: 'TEXT',
      text: params.text,
      access_token: accessToken
    }

    // 如果有連結，加入 link_attachment
    if (params.link) {
      containerPayload.link_attachment = params.link
    }

    const containerResponse = await fetch(
      `${GRAPH_API_BASE_URL}/${threadsUserId}/threads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(containerPayload)
      }
    )

    const containerData = await containerResponse.json()

    if (!containerResponse.ok) {
      console.error('[Threads] Container creation failed:', containerData)
      return {
        success: false,
        error: containerData.error?.message || 'Failed to create thread container'
      }
    }

    const containerId = containerData.id

    // Step 2: 發布 Container
    const publishResponse = await fetch(
      `${GRAPH_API_BASE_URL}/${threadsUserId}/threads_publish`,
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
      console.error('[Threads] Publish failed:', publishData)
      return {
        success: false,
        error: publishData.error?.message || 'Failed to publish thread'
      }
    }

    const postId = publishData.id

    // Threads post URL 格式（需要從 API 獲取 permalink）
    const permalinkResponse = await fetch(
      `${GRAPH_API_BASE_URL}/${postId}?fields=permalink&access_token=${accessToken}`
    )
    const permalinkData = await permalinkResponse.json()
    const postUrl = permalinkData.permalink || `https://www.threads.net/@user/post/${postId}`

    return {
      success: true,
      postId,
      postUrl
    }
  } catch (error) {
    console.error('[Threads] Post error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 獲取 Threads User 資訊
 */
export async function getThreadsUserInfo(
  accessToken: string,
  threadsUserId: string
): Promise<{ username?: string; name?: string; error?: string }> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/${threadsUserId}?fields=id,username,name&access_token=${accessToken}`
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        error: data.error?.message || 'Failed to get Threads user info'
      }
    }

    return {
      username: data.username,
      name: data.name
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 驗證 Threads Access Token
 */
export async function validateThreadsToken(
  accessToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE_URL}/me?fields=id,username&access_token=${accessToken}`
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        valid: false,
        error: data.error?.message || 'Invalid access token'
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
