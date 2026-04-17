export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-[var(--brand-primary)] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">載入中...</p>
      </div>
    </div>
  )
}
