'use client'

import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { ToastProvider } from '@/components/ToastContainer'

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/admin/login?logout=1')
    router.refresh()
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950">
        <AdminSidebar onLogout={handleLogout} />
        <main className="lg:pl-60 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
