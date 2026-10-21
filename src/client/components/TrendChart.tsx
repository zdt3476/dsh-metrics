import { useLayoutEffect, useRef, useState, type FC } from 'react'
import { formatNumber, formatPercent, formatTokens } from '../../shared/format'
import type { ModelTrend, TokenCountersWithRate } from '../../shared/types'
import { MODEL_PALETTE as PALETTE } from '../colors'

export type ChartMode = 'total' | 'cache' | 'model'

export interface TrendChartProps {
  trend: Record<string, TokenCountersWithRate>
  modelTrend?: ModelTrend
  t: (key: string) => string
}


interface SingleTrendCardProps {
  mode: ChartMode
  trend: Record<string, TokenCountersWithRate>
  modelTrend?: ModelTrend
  days: string[]
  title?: string
  compact?: boolean
  showModes?: boolean
  activeMode?: ChartMode
  onSelectMode?: (m: ChartMode) => void
  t: (key: string) => string
}

const SingleTrendCard: FC<SingleTrendCardProps> = ({
  mode,
  trend,
  modelTrend,
  days,
  title,
  compact = false,
  showModes = false,
  activeMode,
  onSelectMode,
  t,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const width = 1000
  const height = compact ? 160 : 220
  const padding = { top: 16, right: 20, bottom: 22, left: 45 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const xStep = days.length > 1 ? innerWidth / (days.length - 1) : innerWidth

  let maxVal = 1
  if (mode === 'total') {
    maxVal = Math.max(...days.map(d => trend[d]?.totalTokens ?? 0), 100)
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

  const cardTitle = title || (
    mode === 'total'
      ? `${t('chart.title')} · ${t('chart.mode.total')}`
      : mode === 'cache'
        ? `${t('chart.title')} · ${t('chart.mode.cache')}`
        : `${t('chart.title')} · ${t('chart.mode.model')}`
  )

  const gradId = `tm-grad-${mode}-${compact ? 'c' : 'f'}`

  return (
    <div className={`tm-chart-card ${compact ? 'compact' : ''}`}>
      <div className="tm-chart-header">
        <h3 className="tm-chart-title" style={compact ? { fontSize: '13px' } : undefined}>
          <span>{cardTitle}</span>
        </h3>

        {showModes && onSelectMode && (
          <div className="tm-chart-modes">
            <button
              type="button"
              className={`tm-chart-mode-btn ${activeMode === 'total' ? 'active' : ''}`}
              onClick={() => onSelectMode('total')}
            >
              {t('chart.mode.total')}
            </button>
            <button
              type="button"
              className={`tm-chart-mode-btn ${activeMode === 'cache' ? 'active' : ''}`}
              onClick={() => onSelectMode('cache')}
            >
              {t('chart.mode.cache')}
            </button>
            {modelTrend && modelTrend.series.length > 0 && (
              <button
                type="button"
                className={`tm-chart-mode-btn ${activeMode === 'model' ? 'active' : ''}`}
                onClick={() => onSelectMode('model')}
              >
                {t('chart.mode.model')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tm-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="tm-chart-svg"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* 水平网格线 */}
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
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
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
            const step = compact ? Math.ceil(days.length / 5) : Math.ceil(days.length / 10)
            if (days.length > 6 && idx % step !== 0 && idx !== days.length - 1) {
              return null
            }
            const x = getX(idx)
            return (
              <text
                key={`label-${day}`}
                x={x}
                y={height - 5}
                textAnchor="middle"
                fontSize="9"
                fill="var(--tm-text-muted)"
              >
                {day.slice(5)}
              </text>
            )
          })}

          {/* 总量平滑曲线与渐变 */}
          {mode === 'total' && (() => {
            const vals = days.map(d => trend[d]?.totalTokens ?? 0)
            const { line, area } = buildSmoothPath(vals)
            return (
              <g>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#${gradId})`} />
                <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" />
                {days.map((_, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={getX(i)}
                    cy={getY(vals[i])}
                    r={hoverIdx === i ? 4.5 : 2}
                    fill="#3b82f6"
                    stroke="var(--tm-bg-card)"
                    strokeWidth="1.2"
                  />
                ))}
              </g>
            )
          })()}

          {/* 缓存命中率平滑曲线 */}
          {mode === 'cache' && (() => {
            const vals = days.map(d => trend[d]?.cacheHitRate ?? 0)
            const { line, area } = buildSmoothPath(vals)
            return (
              <g>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#${gradId})`} />
                <path d={line} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
                {days.map((_, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={getX(i)}
                    cy={getY(vals[i])}
                    r={hoverIdx === i ? 4.5 : 2}
                    fill="#10b981"
                    stroke="var(--tm-bg-card)"
                    strokeWidth="1.2"
                  />
                ))}
              </g>
            )
          })()}

          {/* 模型对比曲线 */}
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
                    strokeWidth="1.8"
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

        {/* 悬浮卡片 Tooltip */}
        {hoverIdx !== null && days[hoverIdx] && (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              left: `${Math.min(80, Math.max(15, (hoverIdx / (days.length - 1 || 1)) * 100))}%`,
              background: 'var(--tm-bg-card)',
              border: '1px solid var(--tm-border)',
              padding: '5px 8px',
              borderRadius: '6px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              fontSize: '11px',
              pointerEvents: 'none',
              transform: 'translateX(-50%)',
              zIndex: 10,
              minWidth: '100px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--tm-text-muted)', marginBottom: '2px' }}>
              {days[hoverIdx]}
            </div>
            {mode === 'total' && trend[days[hoverIdx]] && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>
                  {formatNumber(trend[days[hoverIdx]].totalTokens)}
                </div>
                <div style={{ color: 'var(--tm-text-muted)', fontSize: '10px' }}>
                  {t('field.calls')}: {trend[days[hoverIdx]].calls}
                </div>
              </div>
            )}
            {mode === 'cache' && trend[days[hoverIdx]] && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--tm-success)' }}>
                  {formatPercent(trend[days[hoverIdx]].cacheHitRate)}
                </div>
                <div style={{ color: 'var(--tm-text-muted)', fontSize: '10px' }}>
                  {t('field.cacheRead')}: {formatTokens(trend[days[hoverIdx]].cacheReadTokens)}
                </div>
              </div>
            )}
            {mode === 'model' && modelTrend && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {modelTrend.series.map((s, idx) => (
                  <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ color: PALETTE[idx % PALETTE.length], fontSize: '10px' }}>{s.label}:</span>
                    <span style={{ fontWeight: 500, fontSize: '10px' }}>{formatTokens(s.values[days[hoverIdx]] ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部紧凑图例 */}
      {mode === 'model' && modelTrend && (
        <div className="tm-chart-legend" style={{ paddingTop: '2px', gap: '10px' }}>
          {modelTrend.series.map((s, idx) => (
            <div key={s.key} className="tm-legend-item" style={{ fontSize: '10px' }}>
              <span className="tm-legend-dot" style={{ background: PALETTE[idx % PALETTE.length] }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const TrendChart: FC<TrendChartProps> = ({ trend, modelTrend, t }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [mode, setMode] = useState<ChartMode>('total')

  const days = Object.keys(trend).sort()
  // 模型曲线以其自有日期轴为准，避免用总量轴补 0 造成假性归零。
  const modelDays = modelTrend?.days.length ? [...modelTrend.days].sort() : days

  // 挂载即测量一次，避免窄容器首帧误用三栏布局。
  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return
    setContainerWidth(node.clientWidth)
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  if (days.length === 0) {
    return (
      <div className="tm-chart-card">
        <div className="tm-empty">{t('chart.empty')}</div>
      </div>
    )
  }

  // 当容器宽度 >= 860px 时触发大屏三栏自适应
  const isWide = containerWidth >= 860

  return (
    <div ref={containerRef} className="tm-charts-adaptive-wrap">
      {isWide ? (
        // 大屏：直接展示三栏数据与图表
        <div className="tm-charts-grid-3">
          <SingleTrendCard
            mode="total"
            title={`${t('chart.title')} · ${t('chart.mode.total')}`}
            trend={trend}
            days={days}
            compact
            t={t}
          />
          <SingleTrendCard
            mode="cache"
            title={`${t('chart.title')} · ${t('chart.mode.cache')}`}
            trend={trend}
            days={days}
            compact
            t={t}
          />
          <SingleTrendCard
            mode="model"
            title={`${t('chart.title')} · ${t('chart.mode.model')}`}
            trend={trend}
            modelTrend={modelTrend}
            days={modelDays}
            compact
            t={t}
          />
        </div>
      ) : (
        // 小屏：三栏需要切换，显示单图表与模式切换药丸
        <SingleTrendCard
          mode={mode}
          trend={trend}
          modelTrend={modelTrend}
          days={mode === 'model' ? modelDays : days}
          showModes
          activeMode={mode}
          onSelectMode={setMode}
          t={t}
        />
      )}
    </div>
  )
}
