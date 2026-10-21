import type { FC } from 'react'

export interface SparklineProps {
  /** 按时间升序的数值序列；空数组渲染为占位。 */
  values: number[]
  color?: string
  /** 是否绘制面积渐变，紧凑卡片里建议开启。 */
  area?: boolean
}

const VIEW_WIDTH = 100
const VIEW_HEIGHT = 100
const STROKE_WIDTH = 1.6

/** 迷你趋势线：只表达形状，不带坐标轴与交互。 */
export const Sparkline: FC<SparklineProps> = ({ values, color = 'var(--tm-accent)', area = true }) => {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = VIEW_WIDTH / (values.length - 1)

  const points = values.map((value, index) => ({
    x: index * stepX,
    y: VIEW_HEIGHT - ((value - min) / span) * VIEW_HEIGHT,
  }))

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
  const gradientId = `tm-spark-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg
      className="tm-spark"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
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
    </svg>
  )
}
