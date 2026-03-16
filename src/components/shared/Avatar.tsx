import Image from 'next/image'
import { isValidImageUrl } from '@/lib/security'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}

export function Avatar({ src, name, size = 32, className = '' }: AvatarProps) {
  const initial = name?.[0]?.toUpperCase() || 'U'
  const sizeClass = `w-[${size}px] h-[${size}px]`

  if (src && isValidImageUrl(src)) {
    return (
      <div className={`rounded-full overflow-hidden flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
        <Image
          src={src}
          alt={name || 'User'}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-full bg-[var(--brand-primary)] flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="font-bold"
        style={{
          color: 'var(--text-primary)',
          fontSize: size * 0.4,
        }}
      >
        {initial}
      </span>
    </div>
  )
}
