export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">登入失敗</h2>
        <p className="text-gray-600 mb-4">認證過程發生錯誤，請稍後再試</p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-brand-primary text-text-primary rounded-lg hover:bg-brand-primary-hover transition-colors"
        >
          返回首頁
        </a>
      </div>
    </div>
  )
}
