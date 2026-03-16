import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

interface Club {
  name: string
  description?: string
  brand?: string
  model?: string
  rules?: string
  is_private?: boolean
  created_at?: string
  owner?: { id: string; username?: string; display_name?: string }
}

interface ClubAboutProps {
  club: Club
}

export function ClubAbout({ club }: ClubAboutProps) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-6" style={{ borderColor: 'var(--border-color)' }}>
      {/* Description */}
      {club.description && (
        <div>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>簡介</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{club.description}</p>
        </div>
      )}

      {/* Rules */}
      {club.rules && (
        <div>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>規則</h3>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <MarkdownRenderer content={club.rules} />
          </div>
        </div>
      )}

      {/* Info */}
      <div>
        <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>資訊</h3>
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {club.brand && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-tertiary)' }}>品牌：</span>
              <span>{club.brand}{club.model ? ` ${club.model}` : ''}</span>
            </div>
          )}
          {club.created_at && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-tertiary)' }}>建立日期：</span>
              <span>{new Date(club.created_at).toLocaleDateString('zh-TW')}</span>
            </div>
          )}
          {club.owner && (
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-tertiary)' }}>創辦人：</span>
              <span>{club.owner.display_name || club.owner.username || '匿名'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-tertiary)' }}>類型：</span>
            <span>{club.is_private ? '私人' : '公開'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
