'use client'

import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import carAnimation from '../../public/animations/car-travel.json'

export default function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 監聽頁面載入完成
    const checkNavigation = () => {
      if (document.readyState === 'complete') {
        setIsLoading(false)
      }
    }

    checkNavigation()
    window.addEventListener('load', () => setIsLoading(false))

    return () => {
      window.removeEventListener('load', () => setIsLoading(false))
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="relative w-full max-w-2xl px-8">
        {/* Lottie 動畫 */}
        <div className="w-full h-64 mb-8">
          <Lottie
            animationData={carAnimation}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* 載入文字 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            玩咖 WANT CAR
          </h1>
          <div className="flex items-center justify-center gap-1">
            <span className="text-gray-600 text-lg">正在啟動引擎</span>
            <span className="flex gap-0.5">
              <span className="animate-pulse delay-0 text-blue-600 text-lg">.</span>
              <span className="animate-pulse delay-150 text-blue-600 text-lg">.</span>
              <span className="animate-pulse delay-300 text-blue-600 text-lg">.</span>
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
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
