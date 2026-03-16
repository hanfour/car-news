'use client'

import { NavigationProvider } from '@/contexts/NavigationContext'
import { AppTopBar } from './AppTopBar'
import { AppSidebar } from './AppSidebar'
import { BottomTabBar } from './BottomTabBar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <NavigationProvider>
      <div className="min-h-screen bg-[var(--background)]">
        <AppTopBar />
        <AppSidebar />

        {/* Main content area - offset by sidebar on desktop */}
        <main className="lg:ml-[260px] pb-16 lg:pb-0 min-h-[calc(100vh-56px)]">
          {children}
        </main>

        <BottomTabBar />
      </div>
    </NavigationProvider>
  )
}
