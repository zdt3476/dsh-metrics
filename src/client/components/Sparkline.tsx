import { useMemo, useState, type FC, type MouseEvent } from 'react'

export interface SparklineProps {
  /** 按时间升序的数值序列；空数组渲染为占位。 */
  values: number[]
  /** 与 values 同长度的刻度标签，用于悬停提示（例如日期）。 */
  labels?: string[]
  /** 悬停数值的格式化函数。 */
  format?: (value: number) => string
  color?: string
  /** 是否绘制面积渐变，紧凑卡片里建议开启。 */
  area?: boolean
}

const VIEW_WIDTH = 100
const VIEW_HEIGHT = 100
const STROKE_WIDTH = 1.6

/** 迷你趋势线：表达形状为主，悬停给出该点的刻度与数值。 */
export const Sparkline: FC<SparklineProps> = ({ values, labels, format, color = 'var(--tm-accent)', area = true }) => {
  const [hover, setHover] = useState<number | null>(null)

  const { points, line } = useMemo(() => {
    if (values.length < 2) return { points: [], line: '' }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const stepX = VIEW_WIDTH / (values.length - 1)
    const pts = values.map((value, index) => ({
      x: index * stepX,
      y: VIEW_HEIGHT - ((value - min) / span) * VIEW_HEIGHT,
    }))
    const path = pts.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    return { points: pts, line: path }
  }, [values])

  if (values.length < 2) return null

  const gradientId = `tm-spark-${color.replace(/[^a-z0-9]/gi, '')}`

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (values.length - 1)))
  }

  return (
    <div className="tm-spark-wrap" onMouseLeave={() => setHover(null)}>
      <svg
        className="tm-spark"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={format ? format(values[values.length - 1]) : String(values[values.length - 1])}
        onMouseMove={handleMove}
      >
        {area && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L ${VIEW_WIDTH},${VIEW_HEIGHT} L 0,${VIEW_HEIGHT} Z`} fill={`url(#${gradientId})`} />
          </>
        )}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && points[hover] && (
          <line
            x1={points[hover].x}
            y1={0}
            x2={points[hover].x}
            y2={VIEW_HEIGHT}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {hover !== null && (
        <div className="tm-tip tm-spark-tip" style={{ left: `${(points[hover].x / VIEW_WIDTH) * 100}%` }} role="tooltip">
          {labels?.[hover] && <div className="tm-tip-title">{labels[hover]}</div>}
          <div className="tm-tip-row">
            <b>{format ? format(values[hover]) : String(values[hover])}</b>
          </div>
        </div>
      )}
    </div>
  )
}
