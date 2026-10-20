import type { FC } from 'react'
import type { UpdateCheckResult } from '../../shared/types'

export interface UpdateBannerProps {
  updateInfo: UpdateCheckResult | null
  updating: boolean
  onUpdate: () => void
  t: (key: string) => string
}

export const UpdateBanner: FC<UpdateBannerProps> = ({ updateInfo, updating, onUpdate, t }) => {
  if (!updateInfo || !updateInfo.hasUpdate) return null

  return (
    <div className="tm-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 600 }}>🚀 {t('version.dotNew')}</span>
        <span>
          v{updateInfo.currentVersion} → <strong>v{updateInfo.latestVersion}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {updateInfo.releaseUrl && (
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="tm-btn"
            style={{ textDecoration: 'none' }}
          >
            {t('version.notes')}
          </a>
        )}
        <button
          type="button"
          className="tm-btn active"
          onClick={onUpdate}
          disabled={updating}
        >
          {updating ? t('version.updating') : t('version.update')}
        </button>
      </div>
    </div>
  )
}
