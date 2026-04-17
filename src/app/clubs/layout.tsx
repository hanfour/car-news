import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '車友俱樂部 - 玩咖 WANT CAR',
  description: '加入志同道合的車友俱樂部，分享用車心得與改裝經驗',
  openGraph: {
    title: '車友俱樂部 - 玩咖 WANT CAR',
    description: '加入志同道合的車友俱樂部，分享用車心得與改裝經驗',
  },
}

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return children
}
