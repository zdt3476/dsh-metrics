import type { FC, ReactNode } from 'react'
import { Sparkline } from './Sparkline'

export interface MetricTileProps {
  label: string
  value: string
  /** 悬停解释，用于说明该指标的口径。 */
  hint?: string
  /** 主数值下方的一行补充信息。 */
  children?: ReactNode
  series?: number[]
  color?: string
  /** large 用于首屏两张主卡，small 用于四宫格。 */
  size?: 'large' | 'small'
}

const ACCENT = '#3b82f6'

export const MetricTile: FC<MetricTileProps> = ({
  label,
  value,
  hint,
  children,
  series,
  color = ACCENT,
  size = 'small',
}) => (
  <div className={`tm-tile tm-tile-${size}`}>
    <div className="tm-tile-head">
      <span className="tm-tile-label">{label}</span>
      {hint && (
        <span className="tm-tile-hint" title={hint} aria-label={hint}>
          ⓘ
        </span>
      )}
    </div>
    <div className="tm-tile-value">{value}</div>
    {children && <div className="tm-tile-sub">{children}</div>}
    {series && series.length > 1 && <Sparkline values={series} color={color} />}
  </div>
)
