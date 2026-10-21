import { useMemo, useState, type FC } from 'react'
import { formatTokens } from '../../shared/format'
import type { ModelTrend, TokenCountersWithRate } from '../../shared/types'
import { MODEL_PALETTE } from '../colors'

export interface TrendChartProps {
  trend: Record<string, TokenCountersWithRate>
  modelTrend?: ModelTrend
  t: (key: string) => string
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 220
const PADDING = { top: 12, right: 12, bottom: 20, left: 44 }

interface Series {
  key: string
  label: string
  color: string
  values: number[]
}

/** 平滑折线：用相邻点切线做三次贝塞尔，避免堆叠折点造成的锯齿。 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`
  let d = `M ${points[0].x},${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index === 0 ? 0 : index - 1]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

/** Token 趋势：按模型分组的日级折线，形状优先，数值靠悬停与图例。 */
export const TrendChart: FC<TrendChartProps> = ({ trend, modelTrend, t }) => {
  const [hover, setHover] = useState<number | null>(null)

  const { days, series } = useMemo(() => {
    // 模型曲线以自己的日期轴为准；没有模型数据时退回总量单线。
    const modelDays = modelTrend?.days.length ? [...modelTrend.days].sort() : []
    if (modelDays.length > 1 && modelTrend) {
      return {
        days: modelDays,
        series: modelTrend.series.map((item, index) => ({
          key: item.key,
          label: item.label,
          color: MODEL_PALETTE[index % MODEL_PALETTE.length],
          values: modelDays.map(day => item.values[day] ?? 0),
        })) as Series[],
      }
    }

    const trendDays = Object.keys(trend).sort()
    return {
      days: trendDays,
      series: [
        {
          key: '__total__',
          label: t('chart.mode.total'),
          color: MODEL_PALETTE[0],
          values: trendDays.map(day => trend[day]?.totalTokens ?? 0),
        },
      ] as Series[],
    }
  }, [trend, modelTrend, t])

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right
  const innerHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom
  const stepX = days.length > 1 ? innerWidth / (days.length - 1) : innerWidth
  const max = series.reduce((peak, item) => Math.max(peak, ...item.values), 0) || 1

  const xOf = (index: number) => PADDING.left + index * stepX
  const yOf = (value: number) => PADDING.top + innerHeight - (value / max) * innerHeight

  if (days.length < 2) {
    return (
      <section className="tm-trend">
        <header className="tm-card-head">
          <h3 className="tm-card-title">{t('chart.trendTitle')}</h3>
        </header>
        <div className="tm-empty">{t('chart.empty')}</div>
      </section>
    )
  }

  const labelStep = Math.max(1, Math.ceil(days.length / 6))

  return (
    <section className="tm-trend">
      <header className="tm-card-head">
        <h3 className="tm-card-title">{t('chart.trendTitle')}</h3>
      </header>

      <ul className="tm-trend-legend">
        {series.map(item => (
          <li key={item.key}>
            <i className="tm-legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="tm-trend-chart">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="tm-trend-svg" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map(ratio => {
            const y = PADDING.top + innerHeight * (1 - ratio)
            return (
              <g key={`grid-${ratio}`}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={VIEW_WIDTH - PADDING.right}
                  y2={y}
                  stroke="var(--tm-border)"
                  strokeDasharray="4 4"
                  strokeWidth="0.8"
                />
                <text x={PADDING.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--tm-text-muted)">
                  {formatTokens(max * ratio)}
                </text>
              </g>
            )
          })}

          {series.map(item => (
            <path
              key={`line-${item.key}`}
              d={smoothPath(item.values.map((value, index) => ({ x: xOf(index), y: yOf(value) })))}
              fill="none"
              stroke={item.color}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {days.map((day, index) => {
            if (index % labelStep !== 0 && index !== days.length - 1) return null
            return (
              <text key={`x-${day}`} x={xOf(index)} y={VIEW_HEIGHT - 5} textAnchor="middle" fontSize="9" fill="var(--tm-text-muted)">
                {day.slice(5)}
              </text>
            )
          })}

          {hover !== null && (
            <line
              x1={xOf(hover)}
              y1={PADDING.top}
              x2={xOf(hover)}
              y2={PADDING.top + innerHeight}
              stroke="var(--tm-accent)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}

          {days.map((day, index) => (
            <rect
              key={`hit-${day}`}
              x={xOf(index) - stepX / 2}
              y={PADDING.top}
              width={stepX}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </svg>

        {hover !== null && (
          <div className="tm-trend-tip" style={{ left: `${(xOf(hover) / VIEW_WIDTH) * 100}%` }}>
            <div className="tm-trend-tip-day">{days[hover]}</div>
            {series.map(item => (
              <div key={`tip-${item.key}`} className="tm-trend-tip-row">
                <i className="tm-legend-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
                <b>{formatTokens(item.values[hover] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
