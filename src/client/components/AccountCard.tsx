import type { FC } from 'react'
import { formatCurrency } from '../../shared/format'
import type { AccountSnapshot } from '../../shared/types'

export interface AccountCardProps {
  account: AccountSnapshot | null
  t: (key: string) => string
}

export const AccountCard: FC<AccountCardProps> = ({ account, t }) => {
  if (!account) return null

  const name = account.name || account.id || t('account.current')
  const initial = (name[0] || 'U').toUpperCase()

  return (
    <div className="tm-account-card">
      <div className="tm-account-info">
        <div className="tm-account-avatar">{initial}</div>
        <div className="tm-account-details">
          <div className="tm-account-name">{name}</div>
          <div style={{ fontSize: '11px', color: 'var(--tm-text-muted)' }}>
            {t('account.current')} · {account.id}
          </div>
        </div>
      </div>

      <div className="tm-account-balances">
        {account.balance?.map((w, idx) => (
          <div key={`bal-${idx}`} className="tm-balance-item">
            <span className="tm-balance-label">{w.currency} {t('account.balance')}</span>
            <span className="tm-balance-value">{formatCurrency(w.balance, w.currency)}</span>
          </div>
        ))}

        {account.bonus?.map((w, idx) => (
          <div key={`bonus-${idx}`} className="tm-balance-item">
            <span className="tm-balance-label">{w.currency} {t('account.bonus')}</span>
            <span className="tm-balance-value" style={{ color: 'var(--tm-accent)' }}>
              {formatCurrency(w.balance, w.currency)}
            </span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
          {account.usageUrl && (
            <a
              href={account.usageUrl}
              target="_blank"
              rel="noreferrer"
              className="tm-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('account.usagePage')}
            </a>
          )}
          {account.topUpUrl && (
            <a
              href={account.topUpUrl}
              target="_blank"
              rel="noreferrer"
              className="tm-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('account.topUp')}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
