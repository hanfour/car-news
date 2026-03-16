'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { ImageGallery } from '@/components/shared/ImageGallery'
import { SpecsGrid } from '@/components/garage/SpecsGrid'
import { RelatedCars } from '@/components/garage/RelatedCars'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingCenter } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'

interface Car {
  id: string; brand: string; model: string; year?: number; trim_level?: string; color?: string
  nickname?: string; description?: string; purchase_date?: string; mileage?: number
  cover_image?: string; images?: string[]; is_public: boolean; specs?: Record<string, unknown>
  owner?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function CarDetailPage() {
  const params = useParams()
  const carId = params.id as string
  const { user } = useAuth()
  const [car, setCar] = useState<Car | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const res = await fetch(`/api/garage/${carId}`)
        if (res.ok) {
          const data = await res.json()
          setCar(data.car)
        }
      } catch { /* */ } finally { setLoading(false) }
    }
    fetchCar()
  }, [carId])

  if (loading) return <LoadingCenter size="lg" />

  if (!car) {
    return <div className="max-w-4xl mx-auto px-4 py-16"><EmptyState title="找不到此車輛" /></div>
  }

  const allImages = [
    ...(car.cover_image ? [car.cover_image] : []),
    ...(car.images || []),
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Link href="/garage" className="hover:text-[var(--brand-primary)] transition-colors">愛車展示</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{car.nickname || `${car.brand} ${car.model}`}</span>
      </div>

      {/* Image Gallery */}
      <ImageGallery images={allImages} alt={`${car.brand} ${car.model}`} />

      {/* Car Info */}
      <div className="bg-white rounded-xl border p-6 mt-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {car.nickname || `${car.brand} ${car.model}`}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {car.brand} {car.model} {car.year && `(${car.year})`} {car.trim_level && `· ${car.trim_level}`}
            </p>
          </div>
          {car.color && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {car.color}
            </span>
          )}
        </div>

        {car.description && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>{car.description}</p>
        )}

        {/* Quick stats */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {car.mileage != null && <span>里程：{car.mileage.toLocaleString()} km</span>}
          {car.purchase_date && <span>購入：{new Date(car.purchase_date).toLocaleDateString('zh-TW')}</span>}
        </div>

        {/* Owner */}
        {car.owner && (
          <div className="mt-6 pt-4 border-t flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
            <Link href={`/user/${car.owner.username || car.owner.id}`} className="flex items-center gap-3 group">
              <Avatar src={car.owner.avatar_url} name={car.owner.display_name} size={36} />
              <div>
                <span className="text-sm font-medium group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {car.owner.display_name || '匿名'}
                </span>
                <span className="text-xs block" style={{ color: 'var(--text-tertiary)' }}>車主</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Specs */}
      {car.specs && (
        <div className="bg-white rounded-xl border p-6 mt-4" style={{ borderColor: 'var(--border-color)' }}>
          <SpecsGrid specs={car.specs} />
        </div>
      )}

      {/* Related Cars */}
      <div className="mt-6">
        <RelatedCars carId={carId} brand={car.brand} model={car.model} />
      </div>
    </div>
  )
}
