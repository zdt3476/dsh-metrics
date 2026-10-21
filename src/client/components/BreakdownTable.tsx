import { useMemo, useState, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot, TokenCounters, TokenCountersWithRate } from '../../shared/types'
import { cacheHitRate } from '../../shared/utils'

export type TableTab = 'model' | 'provider' | 'project' | 'session'

export interface BreakdownTableProps {
  snapshot: MetricsSnapshot
  t: (key: string) => string
}

interface RowItem {
  key: string
  name: string
  counters: TokenCounters | TokenCountersWithRate
  extra?: string
}

export const BreakdownTable: FC<BreakdownTableProps> = ({ snapshot, t }) => {
  const [activeTab, setActiveTab] = useState<TableTab>('model')
  const [query, setQuery] = useState('')
  const [sortField, setSortField] = useState<keyof TokenCounters>('totalTokens')
  const [sortAsc, setSortAsc] = useState(false)
  const [compact, setCompact] = useState(true)

  const tabs: Array<{ key: TableTab; label: string }> = [
    { key: 'model', label: t('table.model') },
    { key: 'provider', label: t('table.provider') },
    { key: 'project', label: t('table.project') },
    { key: 'session', label: t('table.session') || t('column.session') },
  ]

  const rawRows: RowItem[] = useMemo(() => {
    switch (activeTab) {
      case 'model':
        return Object.entries(snapshot.byModelName).map(([name, counters]) => ({
          key: name,
          name,
          counters,
        }))
      case 'provider':
        return Object.entries(snapshot.byProvider).map(([name, counters]) => ({
          key: name,
          name,
          counters,
        }))
      case 'project':
        return Object.entries(snapshot.byProject).map(([cwd, counters]) => ({
          key: cwd,
          name: cwd,
          counters,
        }))
      case 'session':
        return Object.values(snapshot.bySession).map(s => ({
          key: s.id,
          name: s.title || t('noTitle'),
          extra: `${s.provider || ''}${s.provider && s.model ? '/' : ''}${s.model || ''}`,
          counters: s.counters,
        }))
      default:
        return []
    }
  }, [activeTab, snapshot, t])

  const filteredRows = useMemo(() => {
    let rows = rawRows
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.extra && r.extra.toLowerCase().includes(q)))
    }
    return rows.sort((a, b) => {
      const valA = a.counters[sortField] ?? 0
      const valB = b.counters[sortField] ?? 0
      return sortAsc ? valA - valB : valB - valA
    })
  }, [rawRows, query, sortField, sortAsc])

  const grandTotal = snapshot.totals.all.totalTokens || 1

  const handleSort = (field: keyof TokenCounters) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const numFmt = (val: number) => (compact ? formatTokens(val) : formatNumber(val))

  return (
    <div className="tm-table-card">
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

      <div className="tm-table-toolbar">
        <input
          type="text"
          className="tm-search-input"
          placeholder={t('table.search')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`tm-btn ${compact ? 'active' : ''}`}
            onClick={() => setCompact(!compact)}
          >
            {t('table.compact')}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--tm-text-muted)' }}>
            {filteredRows.length} {t('table.count')}
          </span>
        </div>
      </div>

      <div className="tm-table-wrap">
        <table className="tm-table">
          <thead>
            <tr>
              <th className="tm-table-rank">{t('ranking.rank')}</th>
              <th style={{ width: '28%' }}>{tabs.find(t => t.key === activeTab)?.label}</th>
              <th className="tm-table-mono" onClick={() => handleSort('totalTokens')}>
                {t('field.total')} {sortField === 'totalTokens' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="tm-table-mono" onClick={() => handleSort('cacheReadTokens')}>
                {t('field.cacheHitRate')}
              </th>
              <th className="tm-table-mono" onClick={() => handleSort('inputTokens')}>
                {t('field.input')} {sortField === 'inputTokens' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="tm-table-mono" onClick={() => handleSort('outputTokens')}>
                {t('field.output')} {sortField === 'outputTokens' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="tm-table-mono" onClick={() => handleSort('reasoningTokens')}>
                {t('field.reasoning')} {sortField === 'reasoningTokens' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th className="tm-table-mono" onClick={() => handleSort('calls')}>
                {t('field.calls')} {sortField === 'calls' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--tm-text-muted)' }}>
                  {t('table.searchEmpty')}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const hitRate = cacheHitRate(row.counters)
                const sharePercent = Math.min(100, Math.max(0, (row.counters.totalTokens / grandTotal) * 100))
                return (
                  <tr key={row.key}>
                    <td className="tm-table-rank">{index + 1}</td>
                    <td>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name}
                      </div>
                      {row.extra && (
                        <div style={{ fontSize: '11px', color: 'var(--tm-text-muted)' }}>{row.extra}</div>
                      )}
                      <div className="tm-progress-bar">
                        <div className="tm-progress-fill" style={{ width: `${sharePercent}%` }} />
                      </div>
                    </td>
                    <td className="tm-table-mono" style={{ fontWeight: 600 }}>
                      {numFmt(row.counters.totalTokens)}
                    </td>
                    <td className="tm-table-mono" style={{ color: 'var(--tm-success)' }}>
                      {formatPercent(hitRate)}
                    </td>
                    <td className="tm-table-mono">{numFmt(row.counters.inputTokens)}</td>
                    <td className="tm-table-mono">{numFmt(row.counters.outputTokens)}</td>
                    <td className="tm-table-mono">{numFmt(row.counters.reasoningTokens)}</td>
                    <td className="tm-table-mono">{formatNumber(row.counters.calls)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
