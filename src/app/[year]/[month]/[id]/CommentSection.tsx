'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Comment {
  id: string
  author_name: string
  content: string
  created_at: string
}

export default function CommentSection({ articleId }: { articleId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [authorName, setAuthorName] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    fetchComments()
  }, [articleId])

  async function fetchComments() {
    try {
      const response = await fetch(`/api/comments?article_id=${articleId}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          author_name: authorName,
          content
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '提交失敗')
        return
      }

      // 成功：清空表单并刷新评论
      setAuthorName('')
      setContent('')
      fetchComments()
    } catch (error) {
      setError('提交失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        評論 ({comments.length})
      </h2>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="author_name" className="block text-sm font-medium text-gray-700 mb-2">
            暱稱 *
          </label>
          <input
            type="text"
            id="author_name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            required
            maxLength={50}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="請輸入您的暱稱"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            評論內容 *
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="請輸入您的評論..."
          />
          <p className="text-xs text-gray-500 mt-1">
            {content.length} / 2000 字
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? '提交中...' : '發表評論'}
        </button>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">載入中...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          還沒有評論，成為第一個留言的人！
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="border-b border-gray-200 pb-6 last:border-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                  {comment.author_name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{comment.author_name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(comment.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                  </p>
                </div>
              </div>
              <p className="text-gray-700 ml-13 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
