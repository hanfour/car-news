'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ForumPostCard } from '@/components/forum/ForumPostCard'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/contexts/AuthContext'

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

export default function CategoryPage() {
  const params = useParams()
  const categorySlug = params.category as string
  const { session } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [sort, setSort] = useState('latest')

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/forum/posts?category=${categorySlug}&page=${page}&sort=${sort}`)
        if (res.ok) {
          const data = await res.json()
          setPosts(data.posts)
          setTotalPages(data.totalPages)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [categorySlug, page, sort])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/community" className="hover:text-[var(--brand-primary)] transition-colors">
          討論區
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{categorySlug}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-sm border rounded-lg"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="latest">最新</option>
            <option value="popular">最熱門</option>
            <option value="active">最活躍</option>
          </select>
        </div>
        {session && (
          <Link href="/community/new" className="btn-primary text-sm">
            發表新貼文
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map(post => (
            <ForumPostCard key={post.id} post={post} />
          ))}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        <EmptyState title="此分類還沒有貼文" description="成為第一個在此分類發文的人！" />
      )}
    </div>
  )
}
