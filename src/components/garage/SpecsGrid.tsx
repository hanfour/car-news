interface SpecsGridProps {
  specs: Record<string, unknown> | null | undefined
}

export function SpecsGrid({ specs }: SpecsGridProps) {
  if (!specs || typeof specs !== 'object' || Object.keys(specs).length === 0) {
    return null
  }

  const entries = Object.entries(specs).filter(([, v]) => v != null && v !== '')

  if (entries.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        規格
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.map(([key, value]) => (
          <div key={key} className="bg-gray-50 rounded-lg p-3">
            <span className="text-xs block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {key}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
