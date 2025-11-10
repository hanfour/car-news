'use client'

import { useState } from 'react'

export default function ShareButtons({ articleId, title }: { articleId: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleShare = async (platform: string) => {
    // 记录分享事件
    try {
      await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, platform })
      })
    } catch (error) {
      console.error('Failed to log share event:', error)
    }

    // 执行分享
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'line':
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank')
        break
      case 'copy':
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        break
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">分享文章</h3>
      <div className="flex gap-3">
        <button
          onClick={() => handleShare('facebook')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
        >
          Facebook
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="px-4 py-2 bg-sky-500 text-white text-sm rounded hover:bg-sky-600 transition"
        >
          Twitter
        </button>
        <button
          onClick={() => handleShare('line')}
          className="px-4 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
        >
          LINE
        </button>
        <button
          onClick={() => handleShare('copy')}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition"
        >
          {copied ? '已複製！' : '複製連結'}
        </button>
      </div>
    </div>
  )
}
