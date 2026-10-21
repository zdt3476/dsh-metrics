import { useMemo, useState, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot, TokenCounters, TokenCountersWithRate } from '../../shared/types'
import { cacheHitRate } from '../../shared/utils'

export type RankingTab = 'model' | 'provider' | 'project' | 'session'
export type RankingSort = 'totalTokens' | 'calls' | 'cacheRate'

export interface UsageRankingProps {
  snapshot: MetricsSnapshot
  t: (key: string) => string
}

interface RankRow {
  key: string
  name: string
  sub?: string
  counters: TokenCounters | TokenCountersWithRate
}

const SORTS: RankingSort[] = ['totalTokens', 'calls', 'cacheRate']

const SORT_LABEL: Record<RankingSort, string> = {
  totalTokens: 'sort.tokens',
  calls: 'sort.calls',
  cacheRate: 'sort.cache',
}

export const UsageRanking: FC<UsageRankingProps> = ({ snapshot, t }) => {
  const [activeTab, setActiveTab] = useState<RankingTab>('model')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<RankingSort>('totalTokens')
  const [expanded, setExpanded] = useState<string | null>(null)

  const tabs: Array<{ key: RankingTab; label: string }> = [
    { key: 'model', label: t('table.model') },
    { key: 'provider', label: t('table.provider') },
    { key: 'project', label: t('table.project') },
    { key: 'session', label: t('table.session') || t('column.session') },
  ]

  const rows: RankRow[] = useMemo(() => {
    switch (activeTab) {
      case 'model':
        return Object.entries(snapshot.byModelName).map(([name, counters]) => ({ key: name, name, counters }))
      case 'provider':
        return Object.entries(snapshot.byProvider).map(([name, counters]) => ({ key: name, name, counters }))
      case 'project':
        return Object.entries(snapshot.byProject).map(([cwd, counters]) => ({ key: cwd, name: cwd, counters }))
      case 'session':
        return Object.values(snapshot.bySession).map(session => ({
          key: session.id,
          name: session.title || t('noTitle'),
          sub: [session.provider, session.model].filter(Boolean).join(' / '),
          counters: session.counters,
        }))
      default:
        return []
    }
  }, [activeTab, snapshot, t])

  const ranked = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? rows.filter(row => row.name.toLowerCase().includes(keyword) || (row.sub?.toLowerCase().includes(keyword) ?? false))
      : rows

    const score = (row: RankRow): number => {
      if (sort === 'calls') return row.counters.calls ?? 0
      if (sort === 'cacheRate') return cacheHitRate(row.counters)
      return row.counters.totalTokens ?? 0
    }
    return [...filtered].sort((a, b) => score(b) - score(a))
  }, [rows, query, sort])

  const grandTotal = snapshot.totals.all.totalTokens || 1

  return (
    <div className="tm-ranking">
      <div className="tm-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`tm-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tm-ranking-toolbar">
        <input
          type="text"
          className="tm-search-input"
          placeholder={t('table.search')}
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="tm-ranking-tools">
          <span className="tm-ranking-count">
            {ranked.length}
            {t('table.count')}
          </span>
          <div className="tm-sort-group" role="group" aria-label={t('sort.by')}>
            {SORTS.map(option => (
              <button
                key={option}
                type="button"
                className={`tm-sort-btn ${sort === option ? 'active' : ''}`}
                aria-pressed={sort === option}
                onClick={() => setSort(option)}
              >
                {t(SORT_LABEL[option])}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tm-ranking-list" role="list">
        {ranked.length === 0 ? (
          <div className="tm-ranking-empty">{t('table.searchEmpty')}</div>
        ) : (
          ranked.map((row, index) => {
            const counters = row.counters
            const share = Math.min(100, Math.max(0, ((counters.totalTokens ?? 0) / grandTotal) * 100))
            const isOpen = expanded === row.key
            const hitRate = cacheHitRate(counters)
            return (
              <div key={row.key} className={`tm-rank-item ${isOpen ? 'open' : ''}`} role="listitem">
                <button
                  type="button"
                  className="tm-rank-row"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : row.key)}
                >
                  <span className="tm-rank-bar" style={{ width: `${share}%` }} aria-hidden="true" />
                  <span className={`tm-rank-no ${index < 3 ? 'top' : ''}`}>{index + 1}</span>
                  <span className="tm-rank-main">
                    <span className="tm-rank-name" title={row.name}>
                      {row.name}
                    </span>
                    <span className="tm-rank-meta">
                      {row.sub && <span className="tm-rank-sub">{row.sub}</span>}
                      <span>{t('field.cacheHitRate')} {formatPercent(hitRate)}</span>
                      <span>{t('field.calls')} {formatNumber(counters.calls ?? 0)}</span>
                    </span>
                  </span>
                  <span className="tm-rank-value">
                    <span className="tm-rank-total">{formatTokens(counters.totalTokens ?? 0)}</span>
                    <span className="tm-rank-share">{share.toFixed(1)}%</span>
                  </span>
                  <span className="tm-rank-chevron" aria-hidden="true">›</span>
                </button>

                {isOpen && (
                  <dl className="tm-rank-detail">
                    {[
                      { key: 'input', label: t('field.input'), value: formatNumber(counters.inputTokens ?? 0) },
                      { key: 'output', label: t('field.output'), value: formatNumber(counters.outputTokens ?? 0) },
                      { key: 'reasoning', label: t('field.reasoning'), value: formatNumber(counters.reasoningTokens ?? 0) },
                      { key: 'cacheRead', label: t('field.cacheRead'), value: formatNumber(counters.cacheReadTokens ?? 0) },
                      { key: 'cacheWrite', label: t('field.cacheWrite'), value: formatNumber(counters.cacheWriteTokens ?? 0) },
                      { key: 'calls', label: t('field.calls'), value: formatNumber(counters.calls ?? 0) },
                    ].map(item => (
                      <div key={item.key} className="tm-rank-detail-cell">
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
