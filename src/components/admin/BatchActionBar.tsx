'use client'

interface BatchActionBarProps {
  selectedCount: number
  processing: boolean
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
  onClear: () => void
}

export function BatchActionBar({
  selectedCount,
  processing,
  onPublish,
  onUnpublish,
  onDelete,
  onClear,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-40 animate-slideUp">
      <div className="bg-slate-900 border-t border-slate-700 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {selectedCount} article{selectedCount > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onPublish}
              disabled={processing}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {processing ? 'Processing...' : 'Publish'}
            </button>
            <button
              onClick={onUnpublish}
              disabled={processing}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 disabled:opacity-50 transition-colors"
            >
              Unpublish
            </button>
            <button
              onClick={onDelete}
              disabled={processing}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onClear}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
