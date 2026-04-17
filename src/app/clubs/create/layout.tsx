import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '建立俱樂部 - 玩咖 WANT CAR',
  robots: { index: false, follow: false },
}

export default function CreateClubLayout({ children }: { children: React.ReactNode }) {
  return children
}
