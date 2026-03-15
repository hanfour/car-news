'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { CarForm } from '@/components/garage/CarForm'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AddCarPage() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
    </div>
  }

  if (!session) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <EmptyState title="請先登入" />
    </div>
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/garage/my" className="hover:text-[var(--brand-primary)] transition-colors">我的車庫</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>新增愛車</span>
        </div>
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--border-color)' }}>
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>新增愛車</h1>
          <CarForm />
        </div>
      </div>
    </div>
  )
}
