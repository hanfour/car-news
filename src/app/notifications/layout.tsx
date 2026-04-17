import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '通知 - 玩咖 WANT CAR',
  robots: { index: false, follow: false },
}

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
