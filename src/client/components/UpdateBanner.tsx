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
    <div className="tm-notice tm-notice--accent">
      <div className="tm-notice-body">
        <span className="tm-notice-title">{t('version.dotNew')}</span>
        <span>
          v{updateInfo.currentVersion} → <strong>v{updateInfo.latestVersion}</strong>
        </span>
      </div>
      <div className="tm-notice-actions">
        {updateInfo.releaseUrl && (
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="tm-btn"
          >
            {t('version.notes')}
          </a>
        )}
        <button
          type="button"
          className="tm-btn tm-btn--primary"
          onClick={onUpdate}
          disabled={updating}
        >
          {updating ? t('version.updating') : t('version.update')}
        </button>
      </div>
    </div>
  )
}
