interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton-light ${className}`} />
}

export function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full skeleton-light" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 skeleton-light rounded" />
          <div className="h-3 w-full skeleton-light rounded" />
          <div className="h-3 w-1/2 skeleton-light rounded" />
        </div>
      </div>
    </div>
  )
}

export function ClubCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg skeleton-light" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 skeleton-light rounded" />
          <div className="h-3 w-1/3 skeleton-light rounded" />
        </div>
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div>
      <div className="h-32 sm:h-48 skeleton-light" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 sm:-mt-16 flex gap-4">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full skeleton-light border-4 border-white" />
        <div className="flex-1 pt-14 space-y-3">
          <div className="h-6 w-40 skeleton-light rounded" />
          <div className="h-4 w-24 skeleton-light rounded" />
          <div className="h-3 w-full skeleton-light rounded" />
        </div>
      </div>
    </div>
  )
}
