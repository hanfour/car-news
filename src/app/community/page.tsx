'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ForumCategoryCard } from '@/components/forum/ForumCategoryCard'
import { ForumPostCard } from '@/components/forum/ForumPostCard'
import { useAuth } from '@/contexts/AuthContext'

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  post_count: number
}

interface Post {
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
  author?: { id: string; username?: string; display_name?: string; avatar_url?: string }
  category?: { name: string; slug: string; icon?: string }
}

export default function CommunityPage() {
  const { session } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, postRes] = await Promise.all([
          fetch('/api/forum/categories'),
          fetch('/api/forum/posts?limit=10'),
        ])

        if (catRes.ok) {
          const catData = await catRes.json()
          setCategories(catData.categories)
        }
        if (postRes.ok) {
          const postData = await postRes.json()
          setRecentPosts(postData.posts)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          討論區
        </h1>
        {session && (
          <Link href="/community/new" className="btn-primary">
            發表新貼文
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 分類列表 */}
          <section className="mb-8">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>
              分類
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(cat => (
                <ForumCategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </section>

          {/* 最新貼文 */}
          <section>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>
              最新討論
            </h2>
            {recentPosts.length > 0 ? (
              <div className="space-y-3">
                {recentPosts.map(post => (
                  <ForumPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                還沒有任何貼文，成為第一個發文的人吧！
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
