import type { FC, ReactNode } from 'react'

export interface MetricCardProps {
  title: string
  value: string | number
  sub?: ReactNode
  hint?: string
}

export const MetricCard: FC<MetricCardProps> = ({ title, value, sub, hint }) => {
  return (
    <div className="tm-card" title={hint}>
      <div className="tm-card-header">
        <span>{title}</span>
      </div>
      <div className="tm-card-value">{value}</div>
      {sub && <div className="tm-card-sub">{sub}</div>}
    </div>
  )
}
