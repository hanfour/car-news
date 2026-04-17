import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '個人動態 - 玩咖 WANT CAR',
  description: '追蹤您關注的車友動態和最新評論',
  robots: { index: false, follow: false },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children
}
