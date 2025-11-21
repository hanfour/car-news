'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * 導航進度內部元件
 */
function NavigationProgressInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // 頁面變化時重置狀態
    setIsNavigating(false)
    setProgress(0)
  }, [pathname, searchParams])

  useEffect(() => {
    // 監聽連結點擊
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href) {
        // 忽略新視窗連結 (target="_blank")
        if (link.target === '_blank') {
          return
        }

        const url = new URL(link.href)
        const currentUrl = new URL(window.location.href)

        // 只在站內連結且 URL 不同時顯示載入
        if (
          url.origin === currentUrl.origin &&
          (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search)
        ) {
          setIsNavigating(true)
          setProgress(0)

          // 模擬進度條增長
          let currentProgress = 0
          const interval = setInterval(() => {
            currentProgress += Math.random() * 30
            if (currentProgress >= 90) {
              currentProgress = 90
              clearInterval(interval)
            }
            setProgress(currentProgress)
          }, 200)
        }
      }
    }

    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [])

  if (!isNavigating) return null

  return (
    <>
      {/* 頂部進度條 */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 全屏遮罩 */}
      <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          {/* 載入動畫 - 汽車圖標 */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            {/* 旋轉的方向盤 */}
            <div className="absolute inset-0 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            {/* 汽車圖標 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-blue-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
          </div>

          {/* 載入文字 */}
          <div className="space-y-2">
            <p className="text-gray-900 font-medium text-lg">正在載入頁面</p>
            <div className="flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 全域導航進度條（帶 Suspense）
 */
export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  )
}
