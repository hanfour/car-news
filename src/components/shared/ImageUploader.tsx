'use client'

import { useState, useRef } from 'react'

interface ImageUploaderProps {
  onUpload: (file: File) => Promise<string>
  currentImage?: string
  className?: string
  shape?: 'circle' | 'rectangle'
  maxSizeMB?: number
  accept?: string
}

export function ImageUploader({
  onUpload,
  currentImage,
  className = '',
  shape = 'rectangle',
  maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp',
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`檔案大小不能超過 ${maxSizeMB}MB`)
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      await onUpload(file)
    } catch {
      setError('上傳失敗，請稍後再試')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const displayImage = preview || currentImage
  const isCircle = shape === 'circle'

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`relative overflow-hidden border-2 border-dashed transition-colors hover:border-[var(--brand-primary)] ${
          isCircle ? 'w-24 h-24 rounded-full' : 'w-full h-40 rounded-lg'
        } ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        style={{ borderColor: 'var(--border-color)' }}
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt="上傳預覽"
            className={`w-full h-full object-cover ${isCircle ? 'rounded-full' : 'rounded-lg'}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <svg className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m-4 4l4-4 4 4m5 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              點擊上傳
            </span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--brand-primary)] rounded-full animate-spin" />
          </div>
        )}
      </button>
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--brand-red)' }}>{error}</p>
      )}
    </div>
  )
}
