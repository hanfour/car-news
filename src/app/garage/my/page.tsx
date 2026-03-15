'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { CarCard } from '@/components/garage/CarCard'
import { EmptyState } from '@/components/shared/EmptyState'

interface Car {
  id: string; brand: string; model: string; year?: number; nickname?: string; color?: string; cover_image?: string
}

export default function MyGaragePage() {
  const { session, loading: authLoading } = useAuth()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCars = async () => {
      if (!session?.access_token) return
      try {
        const res = await fetch('/api/garage', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setCars(data.cars)
        }
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchCars()
  }, [session?.access_token])

  if (authLoading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
    </div>
  }

  if (!session) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <EmptyState title="請先登入" description="登入後即可管理你的車庫" />
    </div>
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>我的車庫</h1>
          <Link href="/garage/add" className="btn-primary text-sm">新增愛車</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : cars.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cars.map(car => <CarCard key={car.id} car={car} showOwner={false} />)}
          </div>
        ) : (
          <EmptyState title="你的車庫還是空的" description="新增你的愛車，和其他車友分享！"
            action={<Link href="/garage/add" className="btn-primary text-sm">新增第一台愛車</Link>}
          />
        )}
      </div>
    </div>
  )
}
