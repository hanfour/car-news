'use client'

import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface NotificationItemProps {
  notification: {
    id: string
    type: string
    body?: string
    is_read: boolean
    created_at: string
    resource_type?: string
    resource_id?: string
    metadata: Record<string, string>
    actor?: {
      id: string
      username?: string
      display_name?: string
      avatar_url?: string
    }
  }
  onClick?: () => void
}

function getNotificationText(type: string): string {
  switch (type) {
    case 'comment_reply': return '回覆了你的評論'
    case 'comment_like': return '對你的評論按了讚'
    case 'new_follower': return '開始追蹤你'
    case 'followed_comment': return '發表了新評論'
    case 'forum_reply': return '回覆了你的貼文'
    case 'car_club_post': return '在車友會發表了新貼文'
    case 'system': return ''
    default: return '發送了通知'
  }
}

function getNotificationLink(notification: NotificationItemProps['notification']): string {
  const { type, metadata } = notification

  if (type === 'comment_reply' || type === 'comment_like') {
    const articleId = metadata?.article_id
    if (articleId) return `#comment-${notification.resource_id}`
  }
  if (type === 'new_follower' && notification.actor) {
    return `/user/${notification.actor.username || notification.actor.id}`
  }
  if (type === 'forum_reply') {
    return `/community/post/${notification.resource_id}`
  }

  return '/notifications'
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

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { actor, type, body, is_read, created_at } = notification
  const link = getNotificationLink(notification)

  return (
    <Link
      href={link}
      onClick={onClick}
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
        !is_read ? 'bg-[var(--brand-primary-lighter)]' : ''
      }`}
    >
      {/* Actor avatar */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
        {actor?.avatar_url && isValidImageUrl(actor.avatar_url) ? (
          <Image
            src={actor.avatar_url}
            alt={actor.display_name || 'User'}
            width={36}
            height={36}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {actor?.display_name?.[0]?.toUpperCase() || type === 'system' ? 'S' : 'U'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
          {actor && (
            <span className="font-medium">{actor.display_name || '匿名用戶'}</span>
          )}
          {' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            {type === 'system' ? body : getNotificationText(type)}
          </span>
        </p>
        {body && type !== 'system' && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {body}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {timeAgo(created_at)}
        </p>
      </div>

      {/* Unread dot */}
      {!is_read && (
        <div className="flex-shrink-0 mt-2">
          <div className="w-2 h-2 rounded-full bg-[var(--brand-primary)]" />
        </div>
      )}
    </Link>
  )
}
