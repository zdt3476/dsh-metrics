import { useMemo, type FC, type ReactNode } from 'react'
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
import { cn } from './cn'
import { Segmented } from './Segmented'
import { Sparkline } from './Sparkline'

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

interface StatProps {
  label: string
  value: string
  /** 悬停解释，说明该指标的口径。 */
  hint?: string
  /** 主行下方的补充信息。 */
  children?: ReactNode
  series?: number[]
  seriesLabels?: string[]
  seriesFormat?: (value: number) => string
  color?: string
  size?: 'lead' | 'metric' | 'support'
}

/**
 * 单个指标。
 * 不套卡片：层级靠「字号 / 字重 / 颜色 / 留白」建立，卡片只在承载整块图形
 * （趋势图、环形图、热力图）时才用，避免整页变成等权色块矩阵。
 */
const Stat: FC<StatProps> = ({
  label,
  value,
  hint,
  children,
  series,
  seriesLabels,
  seriesFormat,
  color = 'var(--tm-series-1)',
  size = 'metric',
}) => (
  <div className={cn('tm-stat', size === 'lead' && 'tm-stat--lead')}>
    <div className="tm-stat-label">
      <span className="tm-truncate">{label}</span>
      {hint && (
        <span className="tm-stat-hint" title={hint} aria-label={hint}>
          i
        </span>
      )}
    </div>
    <div className="tm-stat-value" title={value}>
      {value}
    </div>
    {children && <div className="tm-stat-sub">{children}</div>}
    {series && series.length > 1 && (
      <Sparkline values={series} labels={seriesLabels} format={seriesFormat} color={color} />
    )}
  </div>
)

/**
 * 首屏指标区。
 *
 * 信息层级分三层，视觉重量递减：
 *   1. 主导行（hero）：请求总数与 Token 总数 —— 页面的主问题「用了多少」
 *   2. 支撑行（support）：RPM / TPM / 缓存率 / 成本 —— 佐证与效率
 * 时间范围控件放在标题行右侧，与数据同区，符合「识别优于回忆」。
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

  /**
   * 有失败时不允许四舍五入成 100.00%：203549/203556 = 99.9966% 会进位成
   * 「成功率 100.00% · 失败 7」这种自相矛盾的展示。封顶到 99.99%，宁可显示
   * 一个小瑕疵也不宣称完美。
   */
  const shownSuccessRate = failures > 0 && successRate < 1 ? Math.min(successRate, 0.9999) : successRate

  const composition = [
    { key: 'input', label: t('field.input'), value: stats.inputTokens },
    { key: 'output', label: t('field.output'), value: stats.outputTokens },
    { key: 'cacheRead', label: t('field.cacheRead'), value: stats.cacheReadTokens },
    { key: 'reasoning', label: t('field.reasoning'), value: stats.reasoningTokens },
  ]

  const rangeOptions = TIME_RANGES.map(value => ({ value, label: t(RANGE_LABEL[value]) }))

  return (
    <>
      <div className="tm-panel-head">
        <h2 className="tm-panel-title">{t('summary.title')}</h2>
        <Segmented
          label={t('summary.range')}
          options={rangeOptions}
          value={range}
          onChange={onRangeChange}
        />
      </div>

      <div className="tm-hero">
        <Stat
          size="lead"
          label={t('metric.requests')}
          value={formatNumber(stats.calls)}
          series={recent.calls}
          seriesLabels={recent.labels}
          seriesFormat={formatNumber}
          color="var(--tm-series-3)"
        >
          {failuresKnown && (
            <span className="tm-flag">
              <i className="tm-dot tm-dot--success" />
              {t('metric.successRate')} {formatPercent(shownSuccessRate, 2)}
            </span>
          )}
          <span className="tm-flag tm-flag--muted">
            {t('metric.success')} <b>{formatNumber(stats.calls)}</b>
          </span>
          {failures > 0 && (
            <span className="tm-flag tm-flag--danger">
              {t('metric.failure')} <b>{formatNumber(failures)}</b>
            </span>
          )}
        </Stat>

        <Stat
          size="lead"
          label={t('metric.tokens')}
          value={formatTokens(stats.totalTokens)}
          series={recent.total}
          seriesLabels={recent.labels}
          seriesFormat={formatTokens}
          color="var(--tm-series-1)"
        >
          {composition.slice(0, 2).map((item, index) => (
            <span key={item.key} className="tm-flag tm-flag--muted">
              {index > 0 && <i className="tm-sep" aria-hidden="true" />}
              {item.label} <b>{formatTokens(item.value)}</b>
            </span>
          ))}
        </Stat>

        <Stat
          label={t('field.cacheHitRate')}
          value={formatPercent(stats.cacheHitRate)}
          hint={t('metric.cacheHint')}
          series={recent.cache}
          seriesLabels={recent.labels}
          seriesFormat={value => formatPercent(value / 100)}
          color="var(--tm-series-6)"
        >
          {composition.slice(2).map(item => (
            <span key={item.key} className="tm-flag tm-flag--muted">
              {item.label} <b>{formatTokens(item.value)}</b>
            </span>
          ))}
        </Stat>
      </div>

      <div className="tm-support">
        <Stat
          label={t('metric.rpm')}
          value={formatRate(rpm)}
          hint={t('metric.rpmHint')}
          series={recent.calls}
          seriesLabels={recent.labels}
          seriesFormat={formatNumber}
          color="var(--tm-series-3)"
        >
          {t('metric.lastHour')} {formatNumber(snapshot.rate.calls)}
        </Stat>

        <Stat
          label={t('metric.tpm')}
          value={formatRate(tpm)}
          hint={t('metric.tpmHint')}
          series={recent.total}
          seriesLabels={recent.labels}
          seriesFormat={formatTokens}
          color="var(--tm-series-4)"
        >
          {t('metric.lastHour')} {formatTokens(snapshot.rate.tokens)}
        </Stat>

        <Stat
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
          color="var(--tm-series-2)"
        >
          {cost.summary.unavailable
            ? t('metric.costUnavailable')
            : `${t('metric.activeDays')} ${stats.activeDays}`}
        </Stat>

        <Stat
          label={t('stat.sessions')}
          value={formatNumber(stats.sessionCount)}
        >
          {t('metric.activeDays')} {stats.activeDays}
        </Stat>
      </div>
    </>
  )
}
