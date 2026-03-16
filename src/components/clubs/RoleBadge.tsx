interface RoleBadgeProps {
  role: 'owner' | 'admin' | 'member'
  size?: 'sm' | 'md'
}

const roleConfig = {
  owner: { label: '創辦人', emoji: '👑', bgClass: 'bg-amber-100', textColor: '#92400e' },
  admin: { label: '管理員', emoji: '🛡️', bgClass: 'bg-blue-100', textColor: '#1e40af' },
  member: { label: '成員', emoji: '', bgClass: '', textColor: '' },
}

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  if (role === 'member') return null

  const config = roleConfig[role]
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-medium ${config.bgClass} ${sizeClass}`}
      style={{ color: config.textColor }}
    >
      {config.emoji} {config.label}
    </span>
  )
}
