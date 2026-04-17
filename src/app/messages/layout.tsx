import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '私人訊息 - 玩咖 WANT CAR',
  robots: { index: false, follow: false },
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children
}
