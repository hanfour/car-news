'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CarCard } from '@/components/garage/CarCard'
import { EmptyState } from '@/components/shared/EmptyState'

interface Car {
  id: string; brand: string; model: string; year?: number; nickname?: string; color?: string; cover_image?: string
}

export default function UserGaragePage() {
  const params = useParams()
  const username = params.username as string
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const res = await fetch(`/api/garage/wall?owner=${username}`)
        if (res.ok) {
          const data = await res.json()
          setCars(data.cars)
        }
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchCars()
  }, [username])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href={`/user/${username}`} className="hover:text-[var(--brand-primary)] transition-colors">@{username}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>車庫</span>
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
          <EmptyState title="此用戶還沒有展示愛車" />
        )}
      </div>
    </div>
  )
}
