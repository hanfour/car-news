import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { timeAgo } from '@/lib/utils/timeAgo'

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
          <Avatar src={post.author.avatar_url} name={post.author.display_name} size={40} />
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
