'use client'

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    is_deleted: boolean
    created_at: string
    sender?: { display_name?: string; avatar_url?: string }
  }
  isSelf: boolean
  onDelete?: (id: string) => void
}

export function MessageBubble({ message, isSelf, onDelete }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`group relative max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
          isSelf
            ? 'rounded-br-md'
            : 'rounded-bl-md'
        }`}
        style={{
          backgroundColor: isSelf ? 'var(--brand-primary)' : '#f0f0f0',
          color: isSelf ? '#333' : 'var(--text-primary)',
        }}
      >
        {message.is_deleted ? (
          <span className="italic opacity-60">此訊息已刪除</span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        <div
          className={`text-[10px] mt-0.5 ${isSelf ? 'text-right' : 'text-left'}`}
          style={{ opacity: 0.5 }}
        >
          {time}
        </div>
        {isSelf && !message.is_deleted && onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
            title="刪除訊息"
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
