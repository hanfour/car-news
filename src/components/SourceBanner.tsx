'use client'

import { useState } from 'react'

interface SourceBannerProps {
  sourceUrls: string[]
}

/**
 * 从 URL 提取域名和来源名称
 */
function extractSourceInfo(url: string): { domain: string; name: string } {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace('www.', '')

    // 常见来源名称映射
    const sourceNames: Record<string, string> = {
      'electrek.co': 'Electrek',
      'insideevs.com': 'InsideEVs',
      'teslarati.com': 'Teslarati',
      'carbuzz.com': 'CarBuzz',
      'carscoops.com': 'Carscoops',
      'motorauthority.com': 'Motor Authority',
      'autoblog.com': 'Autoblog',
      'caranddriver.com': 'Car and Driver',
      'motortrend.com': 'MotorTrend',
      'topgear.com': 'Top Gear',
      'jalopnik.com': 'Jalopnik',
      'thedrive.com': 'The Drive',
      'reuters.com': 'Reuters',
      'bloomberg.com': 'Bloomberg',
      'cnbc.com': 'CNBC',
      'bbc.com': 'BBC',
      'theverge.com': 'The Verge',
      'techcrunch.com': 'TechCrunch',
      'engadget.com': 'Engadget',
      'arstechnica.com': 'Ars Technica',
      'newsroom.toyota.com': 'Toyota Newsroom',
      'media.ford.com': 'Ford Media',
      'tesla.com': 'Tesla',
      'press.bmw.com': 'BMW Press',
      'media.mercedes-benz.com': 'Mercedes-Benz Media',
      'newsroom.porsche.com': 'Porsche Newsroom',
    }

    const name = sourceNames[domain] || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)

    return { domain, name }
  } catch {
    return { domain: url, name: 'External Source' }
  }
}

export function SourceBanner({ sourceUrls }: SourceBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!sourceUrls || sourceUrls.length === 0) {
    return null
  }

  const sources = sourceUrls.map(extractSourceInfo)
  const displayedSources = isExpanded ? sources : sources.slice(0, 2)
  const hasMore = sources.length > 2

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">
            資訊來源
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            本文數據彙整自以下 {sources.length} 個來源，點擊閱讀原文獲取更多細節
          </p>

          {/* Source Links */}
          <div className="flex flex-wrap gap-2">
            {displayedSources.map(({ domain, name }, index) => (
              <a
                key={index}
                href={sourceUrls[index]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors group"
              >
                <svg
                  className="w-4 h-4 text-gray-400 group-hover:text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="font-medium">{name}</span>
              </a>
            ))}

            {/* Show More Button */}
            {hasMore && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <span>+{sources.length - 2} 更多</span>
              </button>
            )}

            {/* Collapse Button */}
            {isExpanded && hasMore && (
              <button
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <span>收起</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-3 pt-3 border-t border-blue-100">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          本站專注於汽車數據分析，鼓勵讀者支持原創媒體
        </p>
      </div>
    </div>
  )
}
