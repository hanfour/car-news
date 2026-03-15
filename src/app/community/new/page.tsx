'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ForumNewPostForm } from '@/components/forum/ForumNewPostForm'
import { EmptyState } from '@/components/shared/EmptyState'

export default function NewPostPage() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <EmptyState title="請先登入" description="登入後即可發表貼文" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/community" className="hover:text-[var(--brand-primary)] transition-colors">
          討論區
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>發表新貼文</span>
      </div>

      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          發表新貼文
        </h1>
        <ForumNewPostForm />
      </div>
    </div>
  )
}
