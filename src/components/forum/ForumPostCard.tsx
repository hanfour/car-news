import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface ForumPostCardProps {
  post: {
    id: string
    title: string
    content: string
    view_count: number
    reply_count: number
    like_count: number
    is_pinned: boolean
    created_at: string
    tags?: string[]
    related_brand?: string
    author?: {
      id: string
      username?: string
      display_name?: string
      avatar_url?: string
    }
    category?: {
      name: string
      slug: string
      icon?: string
    }
  }
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

export function ForumPostCard({ post }: ForumPostCardProps) {
  return (
    <Link
      href={`/community/post/${post.id}`}
      className="block bg-white rounded-lg border p-4 transition-colors hover:border-[var(--brand-primary)]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex gap-3">
        {/* 作者頭像 */}
        {post.author && (
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            {post.author.avatar_url && isValidImageUrl(post.author.avatar_url) ? (
              <Image src={post.author.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
            ) : (
              <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                <span className="text-sm font-bold">{post.author.display_name?.[0] || 'U'}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 標題 */}
          <div className="flex items-start gap-2">
            {post.is_pinned && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--brand-primary-lighter)] font-medium flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                置頂
              </span>
            )}
            <h3 className="text-sm font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>
              {post.title}
            </h3>
          </div>

          {/* 內容預覽 */}
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {post.content.replace(/[#*`\[\]]/g, '').substring(0, 150)}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span>{post.author?.display_name || '匿名'}</span>
            <span>{timeAgo(post.created_at)}</span>
            {post.category && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100">
                {post.category.icon} {post.category.name}
              </span>
            )}
            <span>{post.reply_count} 回覆</span>
            <span>{post.view_count} 瀏覽</span>
            {post.like_count > 0 && <span>{post.like_count} 讚</span>}
            {post.related_brand && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--brand-primary-lighter)]">
                {post.related_brand}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
