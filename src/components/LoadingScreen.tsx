'use client'

import { useEffect, useState } from 'react'

export default function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 監聽路由變化
    const handleStart = () => setIsLoading(true)
    const handleComplete = () => setIsLoading(false)

    // Next.js 13+ App Router 使用 performance.getEntriesByType
    const checkNavigation = () => {
      if (document.readyState === 'complete') {
        setIsLoading(false)
      }
    }

    checkNavigation()
    window.addEventListener('load', handleComplete)

    return () => {
      window.removeEventListener('load', handleComplete)
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
      {/* 汽車動畫容器 */}
      <div className="relative w-full max-w-md px-8">
        {/* 道路 */}
        <div className="relative h-1 bg-gray-700 rounded-full overflow-hidden mb-8">
          {/* 道路標線動畫 */}
          <div className="absolute inset-0 flex items-center gap-4 animate-road-lines">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-8 h-0.5 bg-white/50 flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* 汽車 SVG */}
        <div className="relative animate-car-drive">
          <svg
            viewBox="0 0 200 100"
            className="w-32 h-16 mx-auto"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 車身 */}
            <path
              d="M40 50 L60 30 L140 30 L160 50 L180 50 L180 70 L20 70 L20 50 Z"
              fill="#3B82F6"
              stroke="#1E3A8A"
              strokeWidth="2"
            />
            {/* 車窗 */}
            <path
              d="M65 35 L75 45 L125 45 L135 35 Z"
              fill="#60A5FA"
              opacity="0.7"
            />
            {/* 車燈 */}
            <circle cx="170" cy="55" r="4" fill="#FCD34D" />
            <circle cx="30" cy="55" r="4" fill="#EF4444" />
            {/* 車輪 */}
            <g className="animate-wheel-spin origin-[50px_70px]">
              <circle cx="50" cy="70" r="10" fill="#1F2937" />
              <circle cx="50" cy="70" r="5" fill="#374151" />
            </g>
            <g className="animate-wheel-spin origin-[150px_70px]">
              <circle cx="150" cy="70" r="10" fill="#1F2937" />
              <circle cx="150" cy="70" r="5" fill="#374151" />
            </g>
          </svg>
        </div>

        {/* 載入文字 */}
        <div className="text-center mt-8">
          <p className="text-white text-lg font-medium mb-2">玩咖 WANT CAR</p>
          <div className="flex items-center justify-center gap-1">
            <span className="text-gray-400">正在啟動引擎</span>
            <span className="flex gap-0.5">
              <span className="animate-pulse delay-0">.</span>
              <span className="animate-pulse delay-150">.</span>
              <span className="animate-pulse delay-300">.</span>
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes car-drive {
          0%, 100% {
            transform: translateX(-10px);
          }
          50% {
            transform: translateX(10px);
          }
        }

        @keyframes wheel-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes road-lines {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-48px);
          }
        }

        .animate-car-drive {
          animation: car-drive 2s ease-in-out infinite;
        }

        .animate-wheel-spin {
          animation: wheel-spin 0.5s linear infinite;
        }

        .animate-road-lines {
          animation: road-lines 1s linear infinite;
        }

        .delay-0 {
          animation-delay: 0s;
        }

        .delay-150 {
          animation-delay: 0.15s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  )
}
