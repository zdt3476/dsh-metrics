import type { FC } from 'react'

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
}

const TAU = Math.PI * 2

/** 环形占比图：只画弧，标签由外部列表承担。 */
export const DonutChart: FC<DonutChartProps> = ({
  slices,
  centerValue,
  centerLabel,
  size = 160,
  thickness = 26,
}) => {
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

  return (
    <svg
      className="tm-donut"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`${centerLabel} ${centerValue}`}
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--tm-border)" strokeWidth={thickness} opacity="0.35" />
      {arcs.map(arc => (
        <path
          key={arc.key}
          d={arc.path}
          fill="none"
          stroke={arc.color}
          strokeWidth={thickness}
          strokeLinecap="butt"
        />
      ))}
      <text x={center} y={center - 2} textAnchor="middle" className="tm-donut-value">
        {centerValue}
      </text>
      <text x={center} y={center + 16} textAnchor="middle" className="tm-donut-label">
        {centerLabel}
      </text>
    </svg>
  )
}
