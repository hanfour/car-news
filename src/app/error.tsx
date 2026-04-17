'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          發生錯誤
        </h2>
        <p className="text-gray-600 mb-6">
          頁面載入時發生問題，請重試或返回首頁。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 rounded-lg font-medium bg-brand-primary text-text-primary hover:bg-brand-primary-hover transition-colors"
          >
            重新載入
          </button>
          <a
            href="/"
            className="px-6 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            返回首頁
          </a>
        </div>
      </div>
    </div>
  )
}
