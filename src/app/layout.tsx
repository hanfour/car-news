import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ToastProvider } from '@/components/ToastContainer';
import LoadingScreen from '@/components/LoadingScreen';
import NavigationProgress from '@/components/NavigationProgress';
import { Footer } from '@/components/Footer';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://wantcar.autos'),
  title: "玩咖 WANT CAR - 想要車？玩車資訊一網打盡",
  description: "AI 驅動的玩車資訊聚合平台，即時掌握全球車壇動態、新車評測、行業趨勢，用數據洞察汽車產業未來。",
  keywords: "汽車新聞, 玩車資訊, 新車評測, 電動車, 汽車產業, 車壇動態, 玩咖, WANT CAR",
  authors: [{ name: "玩咖 WANT CAR" }],
  openGraph: {
    title: "玩咖 WANT CAR - AI 驅動的玩車資訊平台",
    description: "想要車？從數據到動力，AI 帶你玩懂車界未來",
    type: "website",
    siteName: '玩咖 WANT CAR',
    locale: 'zh_TW',
  },
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Noto Sans TC + Merriweather - 報導者字型 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Merriweather:wght@400;700&display=swap" />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                name: '玩咖 WANT CAR',
                url: 'https://wantcar.autos',
                inLanguage: 'zh-TW',
                description: 'AI 驅動的繁體中文汽車新聞平台',
              },
              {
                '@type': 'Organization',
                name: '玩咖 WANT CAR',
                url: 'https://wantcar.autos',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://wantcar.autos/logo.png',
                  width: 512,
                  height: 512,
                },
              },
            ],
          }) }}
        />
        <LoadingScreen />
        <NavigationProgress />
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
              <Footer />
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
