import { useMemo, useState, type FC } from 'react'
import { formatCurrency, formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { MetricsSnapshot, TokenCounters } from '../../shared/types'
import { colorForName } from '../colors'
import { costByModelKey, groupCounters, rangeModelKeyCounters, splitModelKey, type TimeRange } from '../derived'
import { DonutChart } from './DonutChart'

export interface UsageRankingProps {
  snapshot: MetricsSnapshot
  /** 统计范围：环图与列表都按该范围重新聚合。 */
  range: TimeRange
  t: (key: string, params?: Record<string, string | number>) => string
}

type Metric = 'tokens' | 'calls'

const TOP_SLICES = 5

/**
 * 模型用量：左侧环形图给整体形状，右侧列表给精确数值。
 * 切换「按用量 / 按调用」时图与列表同步换口径，避免两套排序各自为政。
 */
export const UsageRanking: FC<UsageRankingProps> = ({ snapshot, range, t }) => {
  const [metric, setMetric] = useState<Metric>('tokens')
  // 图与图例共用同一个高亮键，悬停任一侧另一侧同步响应
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const { slices, rows, total } = useMemo(() => {
    const valueOf = (counters: TokenCounters) => (metric === 'calls' ? counters.calls : counters.totalTokens)

    // 区间明细按 provider/model 取，成本也在这层算好，模型名的成本由各 provider 相加
    const byKey = rangeModelKeyCounters(snapshot, range)
    const costOfKey = costByModelKey(snapshot, byKey)
    const costOfModel = (name: string): number | null => {
      let sum = 0
      let priced = false
      for (const [key, cost] of costOfKey) {
        if (splitModelKey(key).model !== name || cost === null) continue
        priced = true
        sum += cost
      }
      return priced ? sum : null
    }

    const sorted = [...groupCounters(byKey, 'model')].sort((a, b) => valueOf(b[1]) - valueOf(a[1]))
    const sum = sorted.reduce((acc, [, counters]) => acc + valueOf(counters), 0)

    const head = sorted.slice(0, TOP_SLICES)
    const tail = sorted.slice(TOP_SLICES)
    const restValue = tail.reduce((acc, [, counters]) => acc + valueOf(counters), 0)

    const list = head.map(([name, counters]) => ({
      key: name,
      name,
      value: valueOf(counters),
      color: colorForName(name),
      cost: costOfModel(name),
    }))
    if (restValue > 0) {
      const restCost = tail.reduce((sum, [name]) => sum + (costOfModel(name) ?? 0), 0)
      list.push({ key: '__rest__', name: t('chart.groupRest'), value: restValue, color: '#94a3b8', cost: restCost })
    }

    return {
      slices: list.map(item => ({ key: item.key, value: item.value, color: item.color })),
      rows: list,
      total: sum,
    }
  }, [snapshot, range, metric, t])

  const formatValue = (value: number) => (metric === 'calls' ? formatNumber(value) : formatTokens(value))
  const showCost = Object.keys(snapshot.pricing).length > 0

  const tooltipFor = (key: string) => {
    const row = rows.find(item => item.key === key)
    if (!row) return null
    const share = total > 0 ? row.value / total : 0
    return (
      <>
        <div className="tm-tip-title">{row.name}</div>
        <div className="tm-tip-row">
          <span>{metric === 'calls' ? t('field.calls') : 'tokens'}</span>
          <b>{formatValue(row.value)}</b>
        </div>
        <div className="tm-tip-row">
          <span>{t('metric.share')}</span>
          <b>{formatPercent(share, 1)}</b>
        </div>
        {showCost && (
          <div className="tm-tip-row">
            <span>{t('metric.cost')}</span>
            <b>{row.cost === null ? '—' : formatCurrency(row.cost, 'USD')}</b>
          </div>
        )}
      </>
    )
  }

  return (
    <section className="tm-model-usage">
      <header className="tm-card-head">
        <h3 className="tm-card-title">{t('metric.modelUsage')}</h3>
        <div className="tm-sort-group" role="group" aria-label={t('metric.modelUsage')}>
          <button
            type="button"
            className={`tm-sort-btn ${metric === 'calls' ? 'active' : ''}`}
            aria-pressed={metric === 'calls'}
            onClick={() => setMetric('calls')}
          >
            {t('metric.byCalls')}
          </button>
          <button
            type="button"
            className={`tm-sort-btn ${metric === 'tokens' ? 'active' : ''}`}
            aria-pressed={metric === 'tokens'}
            onClick={() => setMetric('tokens')}
          >
            {t('metric.byTokens')}
          </button>
        </div>
      </header>

      <div className="tm-model-usage-body">
        <DonutChart
          slices={slices}
          centerValue={formatTokens(total)}
          centerLabel={metric === 'calls' ? t('field.calls') : 'tokens'}
          activeKey={activeKey}
          onActiveChange={setActiveKey}
          tooltipFor={tooltipFor}
        />
        <ul className="tm-model-legend">
          {rows.map(row => {
            const share = total > 0 ? row.value / total : 0
            return (
              <li
                key={row.key}
                className={activeKey === row.key ? 'is-active' : ''}
                onMouseEnter={() => setActiveKey(row.key)}
                onMouseLeave={() => setActiveKey(null)}
              >
                <i className="tm-legend-dot" style={{ background: row.color }} />
                <span className="tm-model-name" title={row.name}>
                  {row.name}
                </span>
                {showCost && (
                  <span className="tm-model-cost">
                    {row.cost === null ? '—' : formatCurrency(row.cost, 'USD')}
                  </span>
                )}
                <span className="tm-model-value">{formatValue(row.value)}</span>
                <span className="tm-model-share">{formatPercent(share, 1)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
