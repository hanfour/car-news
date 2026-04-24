'use client'

interface EditFormProps {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
}

/**
 * Inline edit textarea for an existing comment.
 * Behavior and markup are identical to the previous inline JSX.
 */
export function CommentEditForm({ value, onChange, onCancel, onSave, isSaving }: EditFormProps) {
  return (
    <div className="mb-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[var(--brand-primary)] resize-none"
        disabled={isSaving}
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">{value.length}/2000</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            disabled={isSaving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !value.trim()}
            className="px-3 py-1 text-xs text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ReplyFormProps {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  error: string
}

/**
 * Form for posting a new reply to a comment.
 */
export function ReplyForm({ value, onChange, onCancel, onSubmit, isSubmitting, error }: ReplyFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-3 p-3 bg-gray-50 rounded-lg">
      {error && (
        <div className="mb-2 text-xs text-red-600">{error}</div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={1000}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[var(--brand-primary)] resize-none"
        placeholder="寫下你的回覆..."
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">{value.length}/1000</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            disabled={isSubmitting}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !value.trim()}
            className="px-3 py-1 text-xs text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </form>
  )
}
