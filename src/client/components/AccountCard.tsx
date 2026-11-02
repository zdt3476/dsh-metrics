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
    <div className="tm-account">
      <div className="tm-account-id">
        <div className="tm-avatar">{initial}</div>
        <div className="tm-account-text">
          <div className="tm-account-name" title={name}>
            {name}
          </div>
          <div className="tm-account-meta" title={account.id}>
            {t('account.current')}
            {account.id ? ` · ${account.id}` : ''}
          </div>
        </div>
      </div>

      <div className="tm-balances">
        {account.balance?.map((w, idx) => (
          <div key={`bal-${idx}`} className="tm-balance">
            <span className="tm-balance-label">{w.currency} {t('account.balance')}</span>
            <span className="tm-balance-value">{formatCurrency(w.balance, w.currency)}</span>
          </div>
        ))}

        {account.bonus?.map((w, idx) => (
          <div key={`bonus-${idx}`} className="tm-balance">
            <span className="tm-balance-label">{w.currency} {t('account.bonus')}</span>
            <span className="tm-balance-value tm-balance-value--bonus">
              {formatCurrency(w.balance, w.currency)}
            </span>
          </div>
        ))}

        <div className="tm-controls">
          {account.usageUrl && (
            <a
              href={account.usageUrl}
              target="_blank"
              rel="noreferrer"
              className="tm-btn tm-btn--quiet"
            >
              {t('account.usagePage')}
            </a>
          )}
          {account.topUpUrl && (
            <a
              href={account.topUpUrl}
              target="_blank"
              rel="noreferrer"
              className="tm-btn tm-btn--quiet"
            >
              {t('account.topUp')}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
