import { useMemo, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import {
  compositionParts,
  computeRangeStats,
  formatHour,
  peakHour,
  type TimeRange,
} from '../derived'
import { Sparkline } from './Sparkline'

export interface UsageSummaryProps {
  snapshot: MetricsSnapshot
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const RANGES: TimeRange[] = ['all', '30d', '7d']

const RANGE_LABEL: Record<TimeRange, string> = {
  all: 'range.all',
  '30d': 'range.30d',
  '7d': 'range.7d',
}

/**
 * 页面唯一的总量视图：所有聚合数字只在这里出现一次。
 * 时间范围控件也放在这里，作为整页统计口径的单一入口。
 */
export const UsageSummary: FC<UsageSummaryProps> = ({ snapshot, range, onRangeChange, t }) => {
  const stats = useMemo(() => computeRangeStats(snapshot, range), [snapshot, range])
  const hour = useMemo(() => peakHour(snapshot), [snapshot])
  /** 近 30 天的日级序列；没有趋势数据时返回空数组，迷你线自动不渲染。 */
  const recent = useMemo(() => {
    const days = Object.keys(snapshot.trend).sort().slice(-30)
    return {
      total: days.map(day => snapshot.trend[day]?.totalTokens ?? 0),
      cache: days.map(day => (snapshot.trend[day]?.cacheHitRate ?? 0) * 100),
      calls: days.map(day => snapshot.trend[day]?.calls ?? 0),
    }
  }, [snapshot.trend])
  const parts = useMemo(() => compositionParts(stats), [stats])

  const compositionTotal = parts.reduce((sum, part) => sum + part.value, 0)
  const compositionShare = (value: number) =>
    compositionTotal > 0 ? (value / compositionTotal) * 100 : 0

  const legend = [
    { key: 'input', label: t('field.input') },
    { key: 'output', label: t('field.output') },
    { key: 'cacheRead', label: t('field.cacheRead') },
    { key: 'cacheWrite', label: t('field.cacheWrite') },
  ] as const

  const cells: Array<{
    key: string
    label: string
    value: string
    series?: number[]
    color?: string
  }> = [
    { key: 'cache', label: t('field.cacheHitRate'), value: formatPercent(stats.cacheHitRate), series: recent.cache, color: '#10b981' },
    { key: 'calls', label: t('field.calls'), value: formatNumber(stats.calls), series: recent.calls, color: '#3b82f6' },
    { key: 'sessions', label: t('stat.sessions'), value: formatNumber(stats.sessionCount) },
    { key: 'days', label: t('stat.activeDays'), value: String(stats.activeDays) },
    { key: 'peak', label: t('stat.peakHour'), value: hour === null ? '—' : formatHour(hour) },
  ]

  return (
    <section className="tm-summary">
      <header className="tm-summary-head">
        <h2 className="tm-summary-title">{t('summary.title')}</h2>
        <div className="tm-range-group" role="group" aria-label={t('summary.range')}>
          {RANGES.map(value => (
            <button
              key={value}
              type="button"
              className={`tm-range-btn ${range === value ? 'active' : ''}`}
              aria-pressed={range === value}
              onClick={() => onRangeChange(value)}
            >
              {t(RANGE_LABEL[value])}
            </button>
          ))}
        </div>
      </header>

      <div className="tm-summary-body">
        <div className="tm-summary-primary">
          <span className="tm-summary-primary-label">{t('stat.totalTokens')}</span>
          <strong className="tm-summary-primary-value">{formatTokens(stats.totalTokens)}</strong>
          <Sparkline values={recent.total} color="#8b5cf6" />
          <div className="tm-summary-primary-meta">
            <span>
              {t('range.today')}
              <b>{formatTokens(snapshot.totals.today.totalTokens)}</b>
            </span>
            <span>
              {t('summary.week')}
              <b>{formatTokens(snapshot.totals.week.totalTokens)}</b>
            </span>
          </div>
        </div>

        <dl className="tm-summary-stats">
          {cells.map(cell => (
            <div key={cell.key} className="tm-summary-stat">
              <dt>{cell.label}</dt>
              <dd>{cell.value}</dd>
              {cell.series && cell.series.length > 1 && (
                <Sparkline values={cell.series} color={cell.color} area={false} />
              )}
            </div>
          ))}
        </dl>
      </div>

      <div className="tm-composition">
        <div className="tm-composition-head">
          <span className="tm-composition-title">{t('summary.composition')}</span>
          <span className="tm-composition-total">{formatTokens(compositionTotal)}</span>
        </div>
        <div className="tm-composition-bar">
          {parts.map(part => (
            <span
              key={part.key}
              className={`tm-composition-seg seg-${part.key}`}
              style={{ width: `${compositionShare(part.value)}%` }}
              title={`${part.key}: ${formatTokens(part.value)}`}
            />
          ))}
        </div>
        <ul className="tm-composition-legend">
          {legend.map(item => {
            const value = parts.find(part => part.key === item.key)?.value ?? 0
            return (
              <li key={item.key}>
                <i className={`tm-legend-dot seg-${item.key}`} />
                <span className="tm-composition-name">{item.label}</span>
                <b>{formatTokens(value)}</b>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
