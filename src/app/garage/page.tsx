'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CarCard } from '@/components/garage/CarCard'
import { Pagination } from '@/components/shared/Pagination'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/contexts/AuthContext'

interface Car {
  id: string; brand: string; model: string; year?: number; nickname?: string; color?: string; cover_image?: string
  owner?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function GarageWallPage() {
  const { session } = useAuth()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/garage/wall?page=${page}`)
        if (res.ok) {
          const data = await res.json()
          setCars(data.cars)
          setTotalPages(data.totalPages)
        }
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchCars()
  }, [page])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>愛車展示牆</h1>
          {session && (
            <div className="flex gap-2">
              <Link href="/garage/my" className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                我的車庫
              </Link>
              <Link href="/garage/add" className="btn-primary text-sm">
                新增愛車
              </Link>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        ) : cars.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cars.map(car => <CarCard key={car.id} car={car} />)}
            </div>
            <div className="mt-6">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState title="還沒有人展示愛車" description="成為第一個分享愛車的人！" />
        )}
      </div>
    </div>
  )
}
