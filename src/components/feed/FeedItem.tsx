'use client'

import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface FeedItemProps {
  item: {
    type: string
    id: string
    created_at: string
    data: Record<string, unknown>
  }
}

function getArticleUrl(article: { id: string; slug_en: string; published_at: string }) {
  const date = new Date(article.published_at)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `/${year}/${month}/${article.id}`
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-TW')
}

export function FeedItem({ item }: FeedItemProps) {
  if (item.type === 'comment') {
    const data = item.data as {
      content: string
      profile?: { id: string; username?: string; display_name?: string; avatar_url?: string }
      article?: { id: string; title_zh: string; slug_en: string; published_at: string }
    }

    return (
      <div className="bg-white rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
        {/* User info */}
        <div className="flex items-center gap-2 mb-2">
          {data.profile && (
            <Link href={`/user/${data.profile.username || data.profile.id}`} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                {data.profile.avatar_url && isValidImageUrl(data.profile.avatar_url) ? (
                  <Image src={data.profile.avatar_url} alt={data.profile.display_name || '使用者頭像'} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                    <span className="text-xs font-bold">{data.profile.display_name?.[0] || 'U'}</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {data.profile.display_name || '匿名用戶'}
              </span>
            </Link>
          )}
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            發表了評論 · {timeAgo(item.created_at)}
          </span>
        </div>

        {/* Article reference */}
        {data.article && (
          <Link
            href={getArticleUrl(data.article)}
            className="text-xs hover:text-[var(--brand-primary)] transition-colors block mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {data.article.title_zh}
          </Link>
        )}

        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {data.content}
        </p>
      </div>
    )
  }

  if (item.type === 'article') {
    const data = item.data as {
      id: string
      title_zh: string
      slug_en: string
      published_at: string
      cover_image?: string
      primary_brand?: string
      categories?: string[]
    }

    return (
      <Link
        href={getArticleUrl(data)}
        className="block bg-white rounded-lg border overflow-hidden transition-colors hover:border-[var(--brand-primary)]"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex gap-4 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {data.primary_brand && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--brand-primary-lighter)]" style={{ color: 'var(--text-primary)' }}>
                  {data.primary_brand}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {timeAgo(item.created_at)}
              </span>
            </div>
            <h3 className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-primary)' }}>
              {data.title_zh}
            </h3>
          </div>
          {data.cover_image && isValidImageUrl(data.cover_image) && (
            <div className="w-20 h-16 rounded overflow-hidden flex-shrink-0">
              <Image src={data.cover_image} alt={data.title_zh || '文章封面'} width={80} height={64} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </Link>
    )
  }

  return null
}
