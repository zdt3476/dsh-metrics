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
  sub?: string
  counters: TokenCounters | TokenCountersWithRate
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

  const filteredRows = useMemo(() => {
    let rows = rawRows
    const keyword = query.trim().toLowerCase()
    if (keyword) {
      rows = rows.filter(row =>
        row.name.toLowerCase().includes(keyword) || (row.sub?.toLowerCase().includes(keyword) ?? false),
      )
    }
    return rows.sort((a, b) => {
      const left = a.counters[sortField] ?? 0
      const right = b.counters[sortField] ?? 0
      return sortAsc ? left - right : right - left
    })
  }, [rawRows, query, sortField, sortAsc])

  const grandTotal = snapshot.totals.all.totalTokens || 1
  /** 思考用量在多数供应商不上报，全为 0 时整列隐藏，避免占位。 */
  const showReasoning = useMemo(
    () => rawRows.some(row => (row.counters.reasoningTokens ?? 0) > 0),
    [rawRows],
  )

  const handleSort = (field: keyof TokenCounters) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const sortMark = (field: keyof TokenCounters) =>
    sortField === field ? (sortAsc ? ' ▲' : ' ▼') : ''

  const num = (value: number) => (compact ? formatTokens(value) : formatNumber(value))

  const metricColumns: Array<{ field: keyof TokenCounters; label: string; className?: string }> = [
    { field: 'totalTokens', label: t('field.total') },
    { field: 'cacheReadTokens', label: t('field.cacheHitRate') },
    { field: 'inputTokens', label: t('field.input') },
    { field: 'outputTokens', label: t('field.output') },
    ...(showReasoning
      ? [{ field: 'reasoningTokens' as const, label: t('field.reasoning') }]
      : []),
    { field: 'calls', label: t('field.calls') },
  ]

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
          onChange={event => setQuery(event.target.value)}
        />
        <div className="tm-table-tools">
          <span className="tm-table-count">
            {filteredRows.length}
            {t('table.count')}
          </span>
          <button
            type="button"
            className="tm-tool-toggle"
            aria-pressed={compact}
            onClick={() => setCompact(!compact)}
          >
            {compact ? t('table.compact') : t('table.exact')}
          </button>
        </div>
      </div>

      <div className="tm-table-wrap">
        <table className="tm-table">
          <thead>
            <tr>
              <th className="tm-col-name">{tabs.find(tab => tab.key === activeTab)?.label}</th>
              {/* 占比恒等于总用量排序结果，不再提供重复的排序入口 */}
              <th className="tm-table-mono tm-col-share">{t('table.share')}</th>
              {metricColumns.map(column => (
                <th
                  key={column.field}
                  className={`tm-table-mono ${column.field === 'inputTokens' || column.field === 'outputTokens' || column.field === 'reasoningTokens' ? 'tm-col-detail' : ''}`}
                  onClick={() => handleSort(column.field)}
                >
                  {column.label}
                  {sortMark(column.field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={metricColumns.length + 2}
                  style={{ textAlign: 'center', padding: '32px', color: 'var(--tm-text-muted)' }}
                >
                  {t('table.searchEmpty')}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const share = Math.min(100, Math.max(0, (row.counters.totalTokens / grandTotal) * 100))
                return (
                  <tr key={row.key}>
                    <td className="tm-col-name">
                      <div className="tm-row-name">
                        <span className="tm-row-rank">{index + 1}</span>
                        <span className="tm-row-title" title={row.name}>
                          {row.name}
                        </span>
                      </div>
                      {row.sub && (
                        <div className="tm-row-sub" title={row.sub}>
                          {row.sub}
                        </div>
                      )}
                    </td>
                    <td className="tm-table-mono tm-col-share">
                      <span className="tm-share-value">{share.toFixed(1)}%</span>
                      <span className="tm-share-track">
                        <span className="tm-share-fill" style={{ width: `${share}%` }} />
                      </span>
                    </td>
                    {metricColumns.map(column => {
                      const isCache = column.field === 'cacheReadTokens'
                      const value = isCache
                        ? formatPercent(cacheHitRate(row.counters))
                        : column.field === 'calls'
                          ? formatNumber(row.counters.calls)
                          : num(row.counters[column.field] ?? 0)
                      return (
                        <td
                          key={column.field}
                          className={`tm-table-mono ${column.field === 'totalTokens' ? 'tm-cell-strong' : ''} ${isCache ? 'tm-cell-cache' : ''} ${column.field === 'inputTokens' || column.field === 'outputTokens' || column.field === 'reasoningTokens' ? 'tm-col-detail' : ''}`}
                        >
                          {value}
                        </td>
                      )
                    })}
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
