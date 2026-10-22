import { useRef, useState, type FC, type MouseEvent, type ReactNode } from 'react'

export interface DonutSlice {
  key: string
  value: number
  color: string
}

export interface DonutChartProps {
  slices: DonutSlice[]
  centerValue: string
  centerLabel: string
  /** 环的外径像素。 */
  size?: number
  thickness?: number
  /** 当前高亮的扇区，由外部持有以便图例与图形联动。 */
  activeKey?: string | null
  onActiveChange?: (key: string | null) => void
  /** 高亮扇区的提示内容；不传则只有高亮没有浮层。 */
  tooltipFor?: (key: string) => ReactNode
}

const TAU = Math.PI * 2
/** 高亮时扇区加粗的像素数。 */
const HOVER_GROW = 4

/** 环形占比图：只画弧，标签由外部列表承担；悬停高亮并给出数值提示。 */
export const DonutChart: FC<DonutChartProps> = ({
  slices,
  centerValue,
  centerLabel,
  size = 160,
  thickness = 26,
  activeKey = null,
  onActiveChange,
  tooltipFor,
}) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = (size - thickness) / 2
  const center = size / 2

  let angle = -Math.PI / 2
  const arcs = slices.map(slice => {
    const share = total > 0 ? slice.value / total : 0
    const start = angle
    const end = angle + share * TAU
    angle = end

    const x1 = center + radius * Math.cos(start)
    const y1 = center + radius * Math.sin(start)
    const x2 = center + radius * Math.cos(end)
    const y2 = center + radius * Math.sin(end)
    const largeArc = share > 0.5 ? 1 : 0

    // 单段占满整圈时圆弧无法闭合，直接画整圆
    const path =
      share >= 0.9999
        ? `M ${center},${center - radius} A ${radius},${radius} 0 1 1 ${center - 0.01},${center - radius}`
        : `M ${x1},${y1} A ${radius},${radius} 0 ${largeArc} 1 ${x2},${y2}`

    return { key: slice.key, color: slice.color, path, share }
  })

  const handleMove = (event: MouseEvent<SVGPathElement>, key: string) => {
    const host = hostRef.current?.getBoundingClientRect()
    if (!host) return
    onActiveChange?.(key)
    setPointer({ x: event.clientX - host.left, y: event.clientY - host.top })
  }

  return (
    <div
      className="tm-donut-wrap"
      ref={hostRef}
      onMouseLeave={() => {
        onActiveChange?.(null)
        setPointer(null)
      }}
    >
      <svg
        className="tm-donut"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${centerLabel} ${centerValue}`}
      >
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--tm-border)" strokeWidth={thickness} opacity="0.35" />
        {arcs.map(arc => {
          const active = activeKey === arc.key
          const dimmed = activeKey !== null && !active
          return (
            <path
              key={arc.key}
              d={arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth={active ? thickness + HOVER_GROW : thickness}
              strokeLinecap="butt"
              opacity={dimmed ? 0.35 : 1}
              className="tm-donut-arc"
              onMouseMove={event => handleMove(event, arc.key)}
            />
          )
        })}
        <text x={center} y={center - 2} textAnchor="middle" className="tm-donut-value">
          {centerValue}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" className="tm-donut-label">
          {centerLabel}
        </text>
      </svg>

      {activeKey && tooltipFor && pointer && (
        <div className="tm-tip tm-donut-tip" style={{ left: `${pointer.x}px`, top: `${pointer.y}px` }} role="tooltip">
          {tooltipFor(activeKey)}
        </div>
      )}
    </div>
  )
}
