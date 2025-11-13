/**
 * 刪除現有的機車相關文章
 * 使用 Admin API 批次刪除
 */

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'ef8a95d41e606566efd6327faeba50695a837c00e7f3a5942d354abce048797a'
const BASE_URL = process.env.BASE_URL || 'https://www.carnewsai.com'

// 已知的機車文章 ID（用戶提供）
const MOTORCYCLE_ARTICLE_IDS = [
  'pPNB8Ya',
  'LB5HhWj',
  'wyhqk9n',
  'JG4DTEV'
]

async function deleteArticle(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/articles/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      console.error(`❌ Failed to delete ${id}:`, error)
      return false
    }

    const result = await response.json()
    console.log(`✅ Deleted: ${id}`)
    return true
  } catch (error) {
    console.error(`❌ Error deleting ${id}:`, error)
    return false
  }
}

async function main() {
  console.log(`🏍️  Removing ${MOTORCYCLE_ARTICLE_IDS.length} motorcycle articles...\n`)

  let successCount = 0
  let failCount = 0

  for (const id of MOTORCYCLE_ARTICLE_IDS) {
    const success = await deleteArticle(id)
    if (success) {
      successCount++
    } else {
      failCount++
    }
    // 短暫延遲避免請求過快
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`\n📊 Summary:`)
  console.log(`✅ Successfully deleted: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
}

main().catch(console.error)
