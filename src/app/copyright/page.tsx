import { Metadata } from 'next'
import Link from 'next/link'
import { StickyHeader } from '@/components/StickyHeader'
import { POPULAR_BRANDS, BRANDS_BY_COUNTRY } from '@/config/brands'

export const metadata: Metadata = {
  title: '版權聲明 - 玩咖 WANT CAR',
  description: '玩咖 WANT CAR 版權聲明與內容來源說明',
  robots: {
    index: true,
    follow: true,
  },
}

export default function CopyrightPage() {
  return (
    <>
      <StickyHeader popularBrands={POPULAR_BRANDS} brandsByCountry={BRANDS_BY_COUNTRY} showBrands={false} />
      <main className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <article className="bg-white rounded-xl shadow-sm p-8 md:p-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              版權聲明
            </h1>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                關於本站
              </h2>
              <p className="text-gray-600 leading-relaxed">
                玩咖 WANT CAR 是一個 AI 驅動的汽車資訊聚合工具。我們的目標是幫助讀者
                快速了解汽車產業動態，提供客觀的數據分析，而非取代原創媒體。
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                我們鼓勵讀者點擊原文連結，閱讀來源媒體的深度報導，支持優質的汽車新聞創作。
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                內容來源
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                本站內容基於公開數據和官方新聞資料撰寫：
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>所有數據來自各汽車品牌官方發布</li>
                <li>所有來源均已標註並提供原文連結</li>
                <li>我們使用 AI 技術進行數據分析和整理，而非改寫他人文章</li>
                <li>每篇文章開頭均標註資訊來源，方便讀者查閱原文</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                圖片來源
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                本站圖片來源說明：
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>
                  <strong>官方新聞圖片：</strong>
                  來自各汽車品牌 Newsroom / Media Center，已標註來源
                </li>
                <li>
                  <strong>AI 生成圖片：</strong>
                  當無法取得官方圖片時，使用 AI 生成示意圖，並標註「AI 生成示意圖」浮水印
                </li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-4">
                我們不會下載或使用未經授權的私人網站或部落格圖片。
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                版權保護
              </h2>
              <p className="text-gray-600 leading-relaxed">
                我們尊重智慧財產權。如果您認為本站內容侵犯了您的版權，
                請透過我們的{' '}
                <Link href="/dmca" className="text-blue-600 hover:underline">
                  版權問題處理頁面
                </Link>{' '}
                與我們聯繫，我們將於 24 小時內處理。
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                聯繫我們
              </h2>
              <p className="text-gray-600 leading-relaxed">
                如有任何版權疑慮，請聯繫：
              </p>
              <p className="mt-4">
                <a
                  href="mailto:copyright@wantcar.autos"
                  className="text-blue-600 hover:underline font-medium"
                >
                  copyright@wantcar.autos
                </a>
              </p>
            </section>

            <div className="border-t pt-8 mt-8">
              <p className="text-sm text-gray-500">
                最後更新：2024 年 12 月
              </p>
            </div>
          </article>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 text-sm"
            >
              ← 返回首頁
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
