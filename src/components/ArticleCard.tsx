'use client'

import Link from 'next/link'
import Image from 'next/image'

interface ArticleCardProps {
  article: {
    id: string
    title_zh: string
    published_at: string
    source_date?: string  // 來源文章的原始發布時間
    view_count: number
    categories?: string[]
    brands?: string[]
    cover_image?: string | null
  }
  gradient: string
}

/**
 * Reusable article card component for list pages
 * Features:
 * - Gradient background placeholder
 * - AI badge
 * - Category and brand tags
 * - View count and publish date
 */
export function ArticleCard({ article, gradient }: ArticleCardProps) {
  // 使用來源時間作為 URL 路徑（保持一致性）
  const year = article.published_at?.slice(0, 4) || new Date().getFullYear()
  const month = article.published_at?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0')

  // 顯示來源時間給使用者（真實新聞時間）
  const displayDate = article.source_date || article.published_at

  return (
    <Link href={`/${year}/${month}/${article.id}`} prefetch={false}>
      <article className="overflow-hidden transition-all duration-200 cursor-pointer group">
        <div className={`relative aspect-[16/9] bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
          {article.cover_image ? (
            <Image
              src={article.cover_image}
              alt={article.title_zh}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <>
              <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
              <svg className="w-20 h-20 opacity-30" className="text-(--brand-primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </>
          )}
          <div className="absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 z-10" style={{ background: 'linear-gradient(to right, var(--brand-primary), #FFED4E)' }}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            AI
          </div>
        </div>

        <div className="p-4">
          {(article.categories || article.brands) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {article.categories?.slice(0, 1).map((cat: string) => (
                <span key={cat} className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: 'var(--brand-primary-dark)', backgroundColor: 'var(--brand-primary-light)' }}>
                  {cat}
                </span>
              ))}
              {article.brands?.slice(0, 2).map((brand: string) => (
                <span key={brand} className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {brand}
                </span>
              ))}
            </div>
          )}

          <h2 className="text-base font-semibold text-gray-900 group-hover:text-(--brand-primary) line-clamp-2 leading-snug mb-3 transition-colors duration-200">
            {article.title_zh}
          </h2>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {article.view_count}
            </span>
            <time className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(displayDate).toLocaleDateString('zh-TW')}
            </time>
          </div>
        </div>
      </article>
    </Link>
  )
}
