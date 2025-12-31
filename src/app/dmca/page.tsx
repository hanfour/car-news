import { Metadata } from 'next'
import Link from 'next/link'
import { StickyHeader } from '@/components/StickyHeader'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'

export const metadata: Metadata = {
  title: '版權問題處理 (DMCA) - 玩咖 WANT CAR',
  description: '玩咖 WANT CAR 版權問題處理與下架機制',
  robots: {
    index: true,
    follow: true,
  },
}

export default function DMCAPage() {
  return (
    <>
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} showBrands={false} />
      <main className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <article className="bg-white rounded-xl shadow-sm p-8 md:p-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              版權問題處理
            </h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-10">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                我們的承諾
              </h2>
              <p className="text-blue-700">
                如果您認為本站內容侵犯了您的版權，我們將於{' '}
                <strong>24 小時內</strong>確認收到，並於{' '}
                <strong>48 小時內</strong>完成審核處理。
              </p>
            </div>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                舉報方式
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                請發送郵件至{' '}
                <a
                  href="mailto:dmca@wantcar.autos"
                  className="text-blue-600 hover:underline font-medium"
                >
                  dmca@wantcar.autos
                </a>
                ，並包含以下資訊：
              </p>
              <ol className="list-decimal list-inside text-gray-600 space-y-3 ml-4">
                <li>
                  <strong>您的姓名和聯繫方式</strong>
                  <p className="text-gray-500 text-sm ml-6 mt-1">
                    請提供真實姓名、電子郵件和電話（選填）
                  </p>
                </li>
                <li>
                  <strong>涉嫌侵權的內容 URL</strong>
                  <p className="text-gray-500 text-sm ml-6 mt-1">
                    請提供本站上涉嫌侵權的頁面完整網址
                  </p>
                </li>
                <li>
                  <strong>您擁有版權的原始內容</strong>
                  <p className="text-gray-500 text-sm ml-6 mt-1">
                    請提供您原創內容的 URL 或證明文件
                  </p>
                </li>
                <li>
                  <strong>侵權說明</strong>
                  <p className="text-gray-500 text-sm ml-6 mt-1">
                    請簡要說明為何您認為該內容侵犯了您的版權
                  </p>
                </li>
                <li>
                  <strong>您的電子簽名</strong>
                  <p className="text-gray-500 text-sm ml-6 mt-1">
                    請在郵件末尾簽署您的姓名，表示以上資訊屬實
                  </p>
                </li>
              </ol>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                處理流程
              </h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-800">收到舉報</h3>
                    <p className="text-gray-500 text-sm">
                      我們將於 24 小時內確認收到您的舉報
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-800">審核內容</h3>
                    <p className="text-gray-500 text-sm">
                      我們將於 48 小時內完成內容審核
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-800">處理結果</h3>
                    <p className="text-gray-500 text-sm">
                      確認侵權後立即下架，並通知您處理結果
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                反通知程序
              </h2>
              <p className="text-gray-600 leading-relaxed">
                如果您認為被下架的內容並未侵權，您可以發送反通知至{' '}
                <a
                  href="mailto:dmca@wantcar.autos"
                  className="text-blue-600 hover:underline"
                >
                  dmca@wantcar.autos
                </a>
                ，說明您認為內容應該恢復的理由。我們將於 10 個工作日內審核您的反通知。
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                聯繫方式
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600 mb-2">
                  <strong>版權問題專用信箱：</strong>
                </p>
                <a
                  href="mailto:dmca@wantcar.autos"
                  className="text-blue-600 hover:underline font-medium text-lg"
                >
                  dmca@wantcar.autos
                </a>
                <p className="text-gray-500 text-sm mt-4">
                  一般諮詢請使用：
                  <a
                    href="mailto:contact@wantcar.autos"
                    className="text-blue-600 hover:underline ml-1"
                  >
                    contact@wantcar.autos
                  </a>
                </p>
              </div>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-gray-500">
                最後更新：2024 年 12 月
              </p>
              <p className="text-sm text-gray-500 mt-2">
                本處理機制符合《數位千禧年著作權法》(DMCA) 規範
              </p>
            </div>
          </article>

          <div className="mt-8 text-center space-x-4">
            <Link
              href="/copyright"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              版權聲明
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              返回首頁
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
