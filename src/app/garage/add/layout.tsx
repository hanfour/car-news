import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '新增愛車 - 玩咖 WANT CAR',
  robots: { index: false, follow: false },
}

export default function AddCarLayout({ children }: { children: React.ReactNode }) {
  return children
}
