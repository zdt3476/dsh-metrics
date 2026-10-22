import { useMemo, type FC } from 'react'
import { formatCurrency, formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot } from '../../shared/types'
import {
  computeHourlyCost,
  computeRangeCost,
  computeRangeStats,
  dailyCostSeries,
  hourlyCostSeries,
  rangeDayKeys,
  TIME_RANGES,
  type TimeRange,
} from '../derived'
import { MetricTile } from './MetricTile'

export interface UsageSummaryProps {
  snapshot: MetricsSnapshot
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const RANGE_LABEL: Record<TimeRange, string> = {
  today: 'range.today',
  '24h': 'range.24h',
  '3d': 'range.3d',
  '7d': 'range.7d',
  '30d': 'range.30d',
  all: 'range.all',
}

/** 速率类数值：小数量保留两位小数，大数量走紧凑写法。 */
function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1000) return formatTokens(value)
  if (value >= 100) return String(Math.round(value))
  return value.toFixed(2)
}

/**
 * 首屏指标区：两张主卡（请求总数 / Token 总数）+ 四张速率与效率小卡。
 * 每个指标都带一条迷你趋势线，形状比数字先被感知。
 */
export const UsageSummary: FC<UsageSummaryProps> = ({ snapshot, range, onRangeChange, t }) => {
  const stats = useMemo(() => computeRangeStats(snapshot, range), [snapshot, range])

  const recent = useMemo(() => {
    const days = Object.keys(snapshot.trend).sort().slice(-30)
    return {
      labels: days.map(day => day.slice(5)),
      total: days.map(day => snapshot.trend[day]?.totalTokens ?? 0),
      cache: days.map(day => (snapshot.trend[day]?.cacheHitRate ?? 0) * 100),
      calls: days.map(day => snapshot.trend[day]?.calls ?? 0),
    }
  }, [snapshot.trend])

  // RPM / TPM 取最近 60 分钟的真实墙钟速率
  const rpm = snapshot.rate.calls / snapshot.rate.windowMinutes
  const tpm = snapshot.rate.tokens / snapshot.rate.windowMinutes

  const cost = useMemo(() => {
    if (range === '24h') {
      const hour = 3_600_000
      const current = Math.floor(Date.now() / hour)
      return {
        summary: computeHourlyCost(snapshot),
        series: hourlyCostSeries(snapshot),
        labels: Array.from({ length: 24 }, (_, index) =>
          new Date((current - 23 + index) * hour).toLocaleTimeString(undefined, { hour: '2-digit' }),
        ),
      }
    }
    const days = rangeDayKeys(snapshot, range)
    const window = days.slice(-30)
    return {
      summary: computeRangeCost(snapshot, days),
      series: dailyCostSeries(snapshot, window),
      labels: window.map(day => day.slice(5)),
    }
  }, [snapshot, range])

  // 失败统计未开启时没有分母，不能宣称成功率，只展示成功数
  const failuresKnown = snapshot.failedAttempts !== null
  const failures = snapshot.failedAttempts?.count ?? 0
  const successRate = stats.calls + failures > 0 ? stats.calls / (stats.calls + failures) : 0

  const composition = [
    { key: 'input', label: t('field.input'), value: stats.inputTokens },
    { key: 'output', label: t('field.output'), value: stats.outputTokens },
    { key: 'cacheRead', label: t('field.cacheRead'), value: stats.cacheReadTokens },
    { key: 'reasoning', label: t('field.reasoning'), value: stats.reasoningTokens },
  ]

  return (
    <section className="tm-metrics">
      <header className="tm-metrics-head">
        <h2 className="tm-metrics-title">{t('summary.title')}</h2>
        <div className="tm-range-group" role="group" aria-label={t('summary.range')}>
          {TIME_RANGES.map(value => (
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

      <div className="tm-metrics-grid">
        <MetricTile
          size="large"
          label={t('metric.requests')}
          value={formatNumber(stats.calls)}
          series={recent.calls}
          seriesLabels={recent.labels}
          seriesFormat={formatNumber}
          color="#3b82f6"
        >
          {failuresKnown && (
            <span className="tm-pill-stat">
              <i className="tm-dot tm-dot-success" />
              {t('metric.successRate')} {formatPercent(successRate, 2)}
            </span>
          )}
          <span className="tm-pill-stat">
            {t('metric.success')} <b>{formatNumber(stats.calls)}</b>
          </span>
          {failures > 0 && (
            <span className="tm-pill-stat tm-pill-danger">
              {t('metric.failure')} <b>{formatNumber(failures)}</b>
            </span>
          )}
        </MetricTile>

        <MetricTile
          size="large"
          label={t('metric.tokens')}
          value={formatTokens(stats.totalTokens)}
          series={recent.total}
          seriesLabels={recent.labels}
          seriesFormat={formatTokens}
          color="#8b5cf6"
        >
          {composition.map(item => (
            <span key={item.key} className="tm-pill-stat">
              {item.label} <b>{formatTokens(item.value)}</b>
            </span>
          ))}
        </MetricTile>

        <MetricTile
          label={t('metric.rpm')}
          value={formatRate(rpm)}
          hint={t('metric.rpmHint')}
          series={recent.calls}
          seriesLabels={recent.labels}
          seriesFormat={formatNumber}
          color="#10b981"
        >
          {t('metric.lastHour')} {formatNumber(snapshot.rate.calls)}
        </MetricTile>

        <MetricTile
          label={t('metric.tpm')}
          value={formatRate(tpm)}
          hint={t('metric.tpmHint')}
          series={recent.total}
          seriesLabels={recent.labels}
          seriesFormat={formatTokens}
          color="#f59e0b"
        >
          {t('metric.lastHour')} {formatTokens(snapshot.rate.tokens)}
        </MetricTile>

        <MetricTile
          label={t('field.cacheHitRate')}
          value={formatPercent(stats.cacheHitRate)}
          hint={t('metric.cacheHint')}
          series={recent.cache}
          seriesLabels={recent.labels}
          seriesFormat={value => formatPercent(value / 100)}
          color="#64748b"
        >
          {t('field.cacheRead')} {formatTokens(stats.cacheReadTokens)}
          <span className="tm-pill-gap" />
          {t('field.input')} {formatTokens(stats.inputTokens)}
        </MetricTile>

        <MetricTile
          label={t('metric.cost')}
          value={cost.summary.unavailable ? '—' : formatCurrency(cost.summary.total, 'USD')}
          hint={
            cost.summary.missing.length > 0
              ? `${t('metric.costHint')} · ${t('metric.costMissing', { count: cost.summary.missing.length })}`
              : t('metric.costHint')
          }
          series={cost.summary.unavailable ? undefined : cost.series}
          seriesLabels={cost.labels}
          seriesFormat={value => formatCurrency(value, 'USD')}
          color="#06b6d4"
        >
          {cost.summary.unavailable
            ? t('metric.costUnavailable')
            : `${t('metric.activeDays')} ${stats.activeDays}`}
        </MetricTile>
      </div>
    </section>
  )
}
