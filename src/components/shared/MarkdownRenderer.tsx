'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline" />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="border-collapse border border-gray-300 text-sm" />
            </div>
          ),
          th: ({ ...props }) => (
            <th {...props} className="border border-gray-300 px-3 py-2 bg-gray-50 text-left font-medium" />
          ),
          td: ({ ...props }) => (
            <td {...props} className="border border-gray-300 px-3 py-2" />
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            return isInline ? (
              <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm" style={{ color: 'var(--text-primary)' }} {...props}>
                {children}
              </code>
            ) : (
              <code className={`${className} block p-3 bg-gray-50 rounded-lg overflow-x-auto text-sm`} {...props}>
                {children}
              </code>
            )
          },
          img: ({ ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img {...props} className="max-w-full h-auto rounded-lg" loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
