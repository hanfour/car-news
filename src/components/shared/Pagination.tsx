'use client'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="分頁">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
        style={{ color: 'var(--text-secondary)' }}
      >
        上一頁
      </button>
      {pages.map((page, i) =>
        page === '...' ? (
          <span key={`dots-${i}`} className="px-2 py-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 text-sm rounded transition-colors ${
              page === currentPage
                ? 'bg-[var(--brand-primary)] font-bold'
                : 'hover:bg-gray-100'
            }`}
            style={{
              color: page === currentPage ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
        style={{ color: 'var(--text-secondary)' }}
      >
        下一頁
      </button>
    </nav>
  )
}
