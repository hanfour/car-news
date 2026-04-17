import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '發表文章 - 玩咖 WANT CAR',
  robots: { index: false, follow: false },
}

export default function NewPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
