import { useState, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { ModelTrend, TokenCountersWithRate } from '../../shared/types'

export type ChartMode = 'total' | 'cache' | 'model'

export interface TrendChartProps {
  trend: Record<string, TokenCountersWithRate>
  modelTrend?: ModelTrend
  t: (key: string) => string
}

const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#64748b',
]

export const TrendChart: FC<TrendChartProps> = ({ trend, modelTrend, t }) => {
  const [mode, setMode] = useState<ChartMode>('total')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const days = Object.keys(trend).sort()
  if (days.length === 0) {
    return (
      <div className="tm-chart-card">
        <div className="tm-empty">{t('chart.empty')}</div>
      </div>
    )
  }

  const width = 1000
  const height = 220
  const padding = { top: 20, right: 30, bottom: 25, left: 55 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const xStep = days.length > 1 ? innerWidth / (days.length - 1) : innerWidth

  let maxVal = 1
  if (mode === 'total') {
    maxVal = Math.max(...days.map(d => trend[d].totalTokens), 100)
  } else if (mode === 'cache') {
    maxVal = 1
  } else if (mode === 'model' && modelTrend) {
    for (const s of modelTrend.series) {
      for (const d of days) {
        maxVal = Math.max(maxVal, s.values[d] ?? 0)
      }
    }
  }

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxVal))
    return padding.top + innerHeight - ratio * innerHeight
  }

  const getX = (idx: number) => padding.left + idx * xStep

  // 生成平滑贝塞尔曲线
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return { line: '', area: '' }
    if (values.length === 1) {
      const x = getX(0)
      const y = getY(values[0])
      return { line: `M ${x},${y}`, area: '' }
    }

    const points = values.map((v, i) => ({ x: getX(i), y: getY(v) }))
    let d = `M ${points[0].x},${points[0].y}`

    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i === 0 ? 0 : i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] ?? p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }

    const area = `${d} L ${points[points.length - 1].x},${padding.top + innerHeight} L ${points[0].x},${padding.top + innerHeight} Z`
    return { line: d, area }
  }

  return (
    <div className="tm-chart-card">
      <div className="tm-chart-header">
        <h3 className="tm-chart-title">
          <span>{t('chart.title')}</span>
        </h3>

        <div className="tm-chart-modes">
          <button
            type="button"
            className={`tm-chart-mode-btn ${mode === 'total' ? 'active' : ''}`}
            onClick={() => setMode('total')}
          >
            {t('chart.mode.total')}
          </button>
          <button
            type="button"
            className={`tm-chart-mode-btn ${mode === 'cache' ? 'active' : ''}`}
            onClick={() => setMode('cache')}
          >
            {t('chart.mode.cache')}
          </button>
          {modelTrend && modelTrend.series.length > 0 && (
            <button
              type="button"
              className={`tm-chart-mode-btn ${mode === 'model' ? 'active' : ''}`}
              onClick={() => setMode('model')}
            >
              {t('chart.mode.model')}
            </button>
          )}
        </div>
      </div>

      <div className="tm-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="tm-chart-svg"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* 水平网格刻度 */}
          {[0, 0.33, 0.66, 1].map((r, i) => {
            const y = padding.top + innerHeight * (1 - r)
            const label = mode === 'cache' ? `${Math.round(r * 100)}%` : formatTokens(maxVal * r)
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--tm-border)"
                  strokeDasharray="4 4"
                  strokeWidth="0.8"
                  strokeOpacity="0.8"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--tm-text-muted)"
                  fontFamily="var(--tm-font-mono)"
                >
                  {label}
                </text>
              </g>
            )
          })}

          {/* X 轴日期刻度 */}
          {days.map((day, idx) => {
            if (days.length > 12 && idx % Math.ceil(days.length / 10) !== 0 && idx !== days.length - 1) {
              return null
            }
            const x = getX(idx)
            return (
              <text
                key={`label-${day}`}
                x={x}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--tm-text-muted)"
              >
                {day.slice(5)}
              </text>
            )
          })}

          {/* 总量平滑曲线与发光面积 */}
          {mode === 'total' && (() => {
            const vals = days.map(d => trend[d].totalTokens)
            const { line, area } = buildSmoothPath(vals)
            return (
              <g>
                <defs>
                  <linearGradient id="tm-grad-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#tm-grad-total)" />
                <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                {days.map((_, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={getX(i)}
                    cy={getY(vals[i])}
                    r={hoverIdx === i ? 5 : 2.5}
                    fill="#3b82f6"
                    stroke="var(--tm-bg-card)"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            )
          })()}

          {/* 缓存命中率平滑曲线 */}
          {mode === 'cache' && (() => {
            const vals = days.map(d => trend[d].cacheHitRate)
            const { line, area } = buildSmoothPath(vals)
            return (
              <g>
                <defs>
                  <linearGradient id="tm-grad-cache" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#tm-grad-cache)" />
                <path d={line} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                {days.map((_, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={getX(i)}
                    cy={getY(vals[i])}
                    r={hoverIdx === i ? 5 : 2.5}
                    fill="#10b981"
                    stroke="var(--tm-bg-card)"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            )
          })()}

          {/* 按模型对比曲线 */}
          {mode === 'model' && modelTrend && (
            <g>
              {modelTrend.series.map((series, sIdx) => {
                const color = PALETTE[sIdx % PALETTE.length]
                const vals = days.map(d => series.values[d] ?? 0)
                const { line } = buildSmoothPath(vals)
                return (
                  <path
                    key={`s-${series.key}`}
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.85"
                  />
                )
              })}
            </g>
          )}

          {/* 悬浮检测柱 */}
          {days.map((_, idx) => {
            const x = getX(idx)
            const halfStep = xStep / 2
            return (
              <rect
                key={`hover-col-${idx}`}
                x={x - halfStep}
                y={padding.top}
                width={xStep}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverIdx(idx)}
              />
            )
          })}

          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              y1={padding.top}
              x2={getX(hoverIdx)}
              y2={padding.top + innerHeight}
              stroke="var(--tm-accent)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* 现代悬浮卡片 Tooltip */}
        {hoverIdx !== null && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: `${Math.min(85, Math.max(10, (hoverIdx / (days.length - 1 || 1)) * 100))}%`,
              background: 'var(--tm-bg-card)',
              border: '1px solid var(--tm-border)',
              padding: '6px 10px',
              borderRadius: '6px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
              fontSize: '11px',
              pointerEvents: 'none',
              transform: 'translateX(-50%)',
              zIndex: 10,
              minWidth: '120px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--tm-text-muted)', marginBottom: '3px' }}>
              {days[hoverIdx]}
            </div>
            {mode === 'total' && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {formatNumber(trend[days[hoverIdx]].totalTokens)}
                </div>
                <div style={{ color: 'var(--tm-text-muted)' }}>
                  {t('field.calls')}: {trend[days[hoverIdx]].calls}
                </div>
              </div>
            )}
            {mode === 'cache' && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--tm-success)' }}>
                  {formatPercent(trend[days[hoverIdx]].cacheHitRate)}
                </div>
                <div style={{ color: 'var(--tm-text-muted)' }}>
                  {t('field.cacheRead')}: {formatTokens(trend[days[hoverIdx]].cacheReadTokens)}
                </div>
              </div>
            )}
            {mode === 'model' && modelTrend && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {modelTrend.series.map((s, idx) => (
                  <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: PALETTE[idx % PALETTE.length] }}>{s.label}:</span>
                    <span style={{ fontWeight: 500 }}>{formatTokens(s.values[days[hoverIdx]] ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部紧凑图例 */}
      {mode === 'model' && modelTrend && (
        <div className="tm-chart-legend">
          {modelTrend.series.map((s, idx) => (
            <div key={s.key} className="tm-legend-item">
              <span className="tm-legend-dot" style={{ background: PALETTE[idx % PALETTE.length] }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
