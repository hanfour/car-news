import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-400 py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4">
        {/* 主要內容區 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 品牌介紹 */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">玩咖 WANT CAR</h3>
            <p className="text-sm leading-relaxed">
              AI 驅動的汽車資訊聚合平台，為您提供全球車壇最新動態、
              新車評測與行業趨勢分析。
            </p>
          </div>

          {/* 快速連結 */}
          <div>
            <h4 className="text-white font-semibold mb-4">快速連結</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/latest" className="hover:text-white transition-colors">
                  最新文章
                </Link>
              </li>
              <li>
                <Link href="/brand/Tesla" className="hover:text-white transition-colors">
                  熱門品牌
                </Link>
              </li>
              <li>
                <Link href="/category/電動車" className="hover:text-white transition-colors">
                  電動車專區
                </Link>
              </li>
            </ul>
          </div>

          {/* 法律資訊 */}
          <div>
            <h4 className="text-white font-semibold mb-4">法律資訊</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/copyright" className="hover:text-white transition-colors">
                  版權聲明
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="hover:text-white transition-colors">
                  版權問題處理 (DMCA)
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@wantcar.autos"
                  className="hover:text-white transition-colors"
                >
                  聯繫我們
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 分隔線 */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm">
            <p>
              © {currentYear} 玩咖 WANT CAR. All rights reserved.
            </p>
            <p className="mt-4 md:mt-0">
              <span className="text-gray-500">
                本站使用 AI 技術聚合公開資訊，所有來源均已標註。
              </span>
            </p>
          </div>
        </div>

        {/* 法律聲明 */}
        <div className="mt-6 pt-6 border-t border-gray-800 text-xs text-gray-500">
          <p>
            本站內容僅供參考，不構成投資或購買建議。圖片來源：官方新聞稿或 AI 生成。
            如有版權疑慮，請透過{' '}
            <a href="mailto:dmca@wantcar.autos" className="text-gray-400 hover:text-white">
              dmca@wantcar.autos
            </a>{' '}
            聯繫我們，我們將於 24 小時內處理。
          </p>
        </div>
      </div>
    </footer>
  )
}
