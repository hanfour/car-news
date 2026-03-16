'use client'

export type ClubTab = 'posts' | 'members' | 'about'

interface ClubTabsProps {
  activeTab: ClubTab
  onTabChange: (tab: ClubTab) => void
  memberCount: number
  postCount: number
}

export function ClubTabs({ activeTab, onTabChange, memberCount, postCount }: ClubTabsProps) {
  const tabs: { key: ClubTab; label: string; count?: number }[] = [
    { key: 'posts', label: '貼文', count: postCount },
    { key: 'members', label: '成員', count: memberCount },
    { key: 'about', label: '關於' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 mt-4">
      <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--brand-primary)]'
                : 'border-transparent hover:border-gray-300'
            }`}
            style={{ color: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
