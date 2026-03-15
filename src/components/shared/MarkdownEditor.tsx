'use client'

import { useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
}

export function MarkdownEditor({ value, onChange, placeholder, maxLength = 10000, rows = 8 }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50" style={{ borderColor: '#e5e5e5' }}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              !isPreview ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-100'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            編輯
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              isPreview ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-100'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            預覽
          </button>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          支援 Markdown 語法
        </span>
      </div>

      {/* Content */}
      {isPreview ? (
        <div className="p-4 min-h-[200px] bg-white">
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>沒有內容可預覽</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="w-full px-4 py-3 text-sm resize-y focus:outline-none"
          style={{ color: 'var(--text-primary)', minHeight: '200px' }}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-end px-3 py-1 border-t bg-gray-50" style={{ borderColor: '#e5e5e5' }}>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  )
}
