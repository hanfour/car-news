'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { isValidImageUrl } from '@/lib/security'

interface AvatarUploaderProps {
  currentAvatar?: string
}

export function AvatarUploader({ currentAvatar }: AvatarUploaderProps) {
  const { session, refreshProfile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session?.access_token) return

    setError(null)

    if (file.size > 5 * 1024 * 1024) {
      setError('檔案大小不能超過 5MB')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('僅支援 JPG、PNG、WebP 格式')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '上傳失敗')
        setPreview(null)
        return
      }

      await refreshProfile()
    } catch {
      setError('上傳失敗，請稍後再試')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const displayImage = preview || (currentAvatar && isValidImageUrl(currentAvatar) ? currentAvatar : null)

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed transition-colors hover:border-[var(--brand-primary)] flex-shrink-0"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {displayImage ? (
          <Image
            src={displayImage}
            alt="頭像"
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[var(--brand-primary)] flex items-center justify-center">
            <svg className="w-8 h-8" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        )}
      </button>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium transition-colors hover:text-[var(--brand-primary)]"
          style={{ color: 'var(--text-primary)' }}
        >
          {uploading ? '上傳中...' : '更換頭像'}
        </button>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          JPG、PNG 或 WebP，最大 5MB
        </p>
        {error && (
          <p className="text-xs mt-1" style={{ color: 'var(--brand-red)' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
