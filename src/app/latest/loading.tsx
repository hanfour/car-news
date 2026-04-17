export default function LatestLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
              <div className="h-5 bg-gray-200 rounded w-full animate-pulse" />
              <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
