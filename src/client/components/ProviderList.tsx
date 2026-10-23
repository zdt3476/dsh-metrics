import { useMemo, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import { colorForName } from '../colors'
import { formatCurrency } from '../../shared/format'
import { costByModelKey, groupCounters, rangeModelKeyCounters, splitModelKey, type TimeRange } from '../derived'

export interface ProviderListProps {
  snapshot: MetricsSnapshot
  /** 统计范围：列表与占比都按该范围重新聚合。 */
  range: TimeRange
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * 供应商明细：请求数、Token、占比条。
 *
 * 成功率需要按供应商记录失败次数，当前账本只保留全局失败计数，
 * 因此这里不展示成功率列，避免用全局比例冒充单供应商数据。
 */
export const ProviderList: FC<ProviderListProps> = ({ snapshot, range, t }) => {
  const rows = useMemo(() => {
    const byKey = rangeModelKeyCounters(snapshot, range)
    const providerTotals = groupCounters(byKey, 'provider')
    const totalTokens = [...providerTotals.values()].reduce((sum, counters) => sum + (counters.totalTokens ?? 0), 0)
    const showCost = Object.keys(snapshot.pricing).length > 0

    // 供应商成本：区间内各 provider/model 的成本按供应商相加
    const costOfKey = costByModelKey(snapshot, byKey)
    const costByProvider = new Map<string, number>()
    for (const [key, cost] of costOfKey) {
      if (cost === null) continue
      const { provider } = splitModelKey(key)
      costByProvider.set(provider, (costByProvider.get(provider) ?? 0) + cost)
    }

    return [...providerTotals]
      .sort((a, b) => (b[1].totalTokens ?? 0) - (a[1].totalTokens ?? 0))
      .map(([name, counters]) => ({
        key: name,
        name,
        calls: counters.calls ?? 0,
        tokens: counters.totalTokens ?? 0,
        share: totalTokens > 0 ? (counters.totalTokens ?? 0) / totalTokens : 0,
        cost: showCost ? (costByProvider.get(name) ?? null) : null,
      }))
  }, [snapshot, range])

  const showCost = Object.keys(snapshot.pricing).length > 0

  return (
    <section className="tm-providers">
      <header className="tm-card-head">
        <h3 className="tm-card-title">{t('metric.providers')}</h3>
        <span className="tm-activity-hint">{rows.length}</span>
      </header>

      <ul className="tm-provider-list">
        {rows.map(row => (
          <li key={row.key}>
            <i className="tm-legend-dot" style={{ background: colorForName(row.name) }} />
            <span className="tm-provider-name" title={row.name}>
              {row.name}
            </span>
            <span className="tm-provider-calls">
              {formatNumber(row.calls)} {t('field.calls')}
            </span>
            <span className="tm-provider-tokens">{formatTokens(row.tokens)}</span>
            {showCost && (
              <span className="tm-provider-cost">
                {row.cost === null ? '—' : formatCurrency(row.cost, 'USD')}
              </span>
            )}
            <span className="tm-provider-share">{formatPercent(row.share, 1)}</span>
            <span className="tm-provider-track">
              <span className="tm-provider-fill" style={{ width: `${Math.max(1, row.share * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
