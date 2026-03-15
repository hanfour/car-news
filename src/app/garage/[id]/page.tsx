'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'
import { EmptyState } from '@/components/shared/EmptyState'

interface Car {
  id: string; brand: string; model: string; year?: number; trim_level?: string; color?: string
  nickname?: string; description?: string; purchase_date?: string; mileage?: number
  cover_image?: string; images?: string[]; is_public: boolean
  owner?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

export default function CarDetailPage() {
  const params = useParams()
  const carId = params.id as string
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

  if (loading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
    </div>
  }

  if (!car) {
    return <div className="max-w-4xl mx-auto px-4 py-16">
      <EmptyState title="找不到此車輛" />
    </div>
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/garage" className="hover:text-[var(--brand-primary)] transition-colors">愛車展示</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{car.nickname || `${car.brand} ${car.model}`}</span>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
          {/* Cover */}
          <div className="aspect-video bg-gray-100 relative">
            {car.cover_image && isValidImageUrl(car.cover_image) ? (
              <Image src={car.cover_image} alt="" fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">🚗</span>
              </div>
            )}
          </div>

          <div className="p-6">
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
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
                  {car.color}
                </span>
              )}
            </div>

            {car.description && (
              <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>{car.description}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {car.mileage && <span>里程：{car.mileage.toLocaleString()} km</span>}
              {car.purchase_date && <span>購入：{new Date(car.purchase_date).toLocaleDateString('zh-TW')}</span>}
            </div>

            {/* Owner */}
            {car.owner && (
              <div className="mt-6 pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
                <Link href={`/user/${car.owner.username || car.owner.id}`} className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    {car.owner.avatar_url && isValidImageUrl(car.owner.avatar_url) ? (
                      <Image src={car.owner.avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
                        <span className="text-xs font-bold">{car.owner.display_name?.[0] || 'U'}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                    {car.owner.display_name || '匿名'}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
