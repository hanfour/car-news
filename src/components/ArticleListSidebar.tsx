import Link from 'next/link'
import { createClient } from '@/lib/supabase'

async function getPopularTags() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('generated_articles')
    .select('categories, brands, view_count')
    .eq('published', true)

  if (error) {
    console.error('Failed to fetch articles for tags:', error)
    return []
  }

  // Aggregate view counts by tag
  const tagCounts: Record<string, { count: number; type: 'category' | 'brand' }> = {}

  data?.forEach(article => {
    const viewCount = article.view_count || 0

    // Process categories
    article.categories?.forEach((cat: string) => {
      if (!tagCounts[cat]) {
        tagCounts[cat] = { count: 0, type: 'category' }
      }
      tagCounts[cat].count += viewCount
    })

    // Process brands
    article.brands?.forEach((brand: string) => {
      if (!tagCounts[brand]) {
        tagCounts[brand] = { count: 0, type: 'brand' }
      }
      tagCounts[brand].count += viewCount
    })
  })

  // Sort by view count and return top 10
  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([tag, data]) => ({ tag, ...data }))
}

/**
 * Sidebar component for article list pages
 * Shows popular tags and hot search items
 */
export async function ArticleListSidebar() {
  const popularTags = await getPopularTags()

  return (
    <aside className="space-y-6">
      {/* 熱門內容 */}
      <div className="bg-white rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">熱門內容</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularTags.length > 0 ? (
            popularTags.map(({ tag, type }) => {
              // Determine link URL based on tag type
              const href = type === 'category' ? `/category/${encodeURIComponent(tag)}` : `/brand/${encodeURIComponent(tag)}`

              return (
                <Link
                  key={tag}
                  href={href}
                  className="flex-none w-[calc(33.333%-0.333rem)] text-center px-2 py-1.5 text-xs text-gray-700 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                >
                  {tag}
                </Link>
              )
            })
          ) : (
            <p className="text-sm text-gray-500">暫無數據</p>
          )}
        </div>
      </div>

      {/* 熱搜榜 */}
      <div className="bg-white rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-900">熱搜榜</h3>
        </div>
        <div className="space-y-3">
          {[
            '網傳小米SU7或將改款 變化點是啥',
            '全新奇瑞瑞虎8正式上市',
            '10月銷量發榜 特斯拉暴跌',
            '宏光MINIEV四門版長續航車型上市',
            '探店BBA同家店報價差兩萬',
            '11月新車申報 你想看的都在這',
            '東風奕派eπ007+新車體驗',
            '東風奕派eπ007+上市',
            '長安汽車：舉報不實信息最高獎100萬'
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-2 group cursor-pointer">
              <span
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold"
                style={{
                  color: index < 3 ? '#FFBB00' : '#999'
                }}
              >
                {index + 1}
              </span>
              <p className="flex-1 text-sm text-gray-700 group-hover:text-gray-900 line-clamp-2 leading-relaxed">
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
