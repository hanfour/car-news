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
}

export function MessageBubble({ message, isSelf }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
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
      </div>
    </div>
  )
}
