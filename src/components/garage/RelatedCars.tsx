'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface RelatedCar {
  id: string
  brand: string
  model: string
  year?: number
  nickname?: string
  cover_image?: string
  owner?: { username?: string; display_name?: string }
}

interface RelatedCarsProps {
  carId: string
  brand: string
  model: string
}

export function RelatedCars({ carId, brand, model }: RelatedCarsProps) {
  const [cars, setCars] = useState<RelatedCar[]>([])

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await fetch(`/api/garage/${carId}/related`)
        if (res.ok) {
          const data = await res.json()
          setCars(data.cars || [])
        }
      } catch (err) { console.error('[RelatedCars] fetchRelated:', err) }
    }
    fetchRelated()
  }, [carId])

  if (cars.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        同品牌車輛
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cars.map(car => (
          <Link
            key={car.id}
            href={`/garage/${car.id}`}
            className="bg-white rounded-lg border overflow-hidden hover:border-[var(--brand-primary)] transition-colors"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="aspect-[4/3] bg-gray-100 relative">
              {car.cover_image && isValidImageUrl(car.cover_image) ? (
                <Image src={car.cover_image} alt={`${car.brand} ${car.model}`} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🚗</div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {car.nickname || `${car.brand} ${car.model}`}
              </p>
              {car.owner?.display_name && (
                <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  by {car.owner.display_name}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
